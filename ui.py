"""Lightweight chat + RAG interface building blocks."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, List, Optional, Sequence, Tuple

from langchain.chains import ConversationalRetrievalChain
from langchain.schema import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

try:  # Optional dependencies for embeddings/vector stores
    from langchain_openai import OpenAIEmbeddings
except ImportError:  # pragma: no cover - optional
    OpenAIEmbeddings = None  # type: ignore

try:
    from langchain_community.embeddings import HuggingFaceEmbeddings
except ImportError:  # pragma: no cover - optional
    HuggingFaceEmbeddings = None  # type: ignore

try:
    from langchain_community.vectorstores import FAISS
except ImportError:  # pragma: no cover - optional
    FAISS = None  # type: ignore

from llm import llm_registry

TEXT_EXTENSIONS = {".txt", ".md", ".tex", ".json", ".py", ".rst"}
PDF_EXTENSIONS = {".pdf"}


def _read_text_file(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def _read_pdf_file(path: Path) -> str:
    """
    Very light PDF text extraction to avoid an extra dependency.
    Falls back to blank string if the binary cannot be parsed cleanly.
    """
    try:
        from pdfminer.high_level import extract_text  # type: ignore
    except ImportError:  # pragma: no cover - optional
        return ""
    try:
        return extract_text(path)
    except Exception:
        return ""


def _load_single_document(path: Path) -> Optional[Document]:
    suffix = path.suffix.lower()
    text = ""
    if suffix in TEXT_EXTENSIONS:
        text = _read_text_file(path)
    elif suffix in PDF_EXTENSIONS:
        text = _read_pdf_file(path)
    if not text.strip():
        return None
    return Document(page_content=text, metadata={"source": str(path)})


def load_documents(
    source_paths: Iterable[Path],
) -> List[Document]:
    docs: List[Document] = []
    for path in source_paths:
        if not path.exists() or not path.is_file():
            continue
        doc = _load_single_document(path)
        if doc:
            docs.append(doc)
    return docs


def load_directory(
    directory: Path,
    glob: str = "**/*",
) -> List[Document]:
    paths = [path for path in directory.rglob(glob) if path.suffix.lower() in (TEXT_EXTENSIONS | PDF_EXTENSIONS)]
    return load_documents(paths)


def split_documents(
    documents: Sequence[Document],
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
) -> List[Document]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", " ", ""],
    )
    return splitter.split_documents(documents)


def _resolve_embeddings(model_name: Optional[str] = None):
    if model_name and model_name.lower().startswith("openai"):
        if not OpenAIEmbeddings:
            raise RuntimeError("langchain-openai not installed, cannot use OpenAIEmbeddings.")
        return OpenAIEmbeddings()
    if HuggingFaceEmbeddings:
        target = model_name or "sentence-transformers/all-MiniLM-L6-v2"
        return HuggingFaceEmbeddings(model_name=target)
    if OpenAIEmbeddings:
        return OpenAIEmbeddings()
    raise RuntimeError("No embedding backend available. Install langchain-openai or langchain-community embeddings.")


def build_vectorstore(
    documents: Sequence[Document],
    embedding_model: Optional[str] = None,
):
    if not documents:
        raise ValueError("No documents provided for vector store construction.")
    if not FAISS:
        raise RuntimeError("FAISS vector store is unavailable. Install langchain-community[faiss].")
    embeddings = _resolve_embeddings(embedding_model)
    return FAISS.from_documents(documents, embeddings)


@dataclass
class ChatTurn:
    role: str
    content: str


@dataclass
class ResearchChatSession:
    """
    Holds an interactive conversation with an LLM once the research doc is ready.

    Example:
        session = ResearchChatSession(context_tex=path_to_tex)
        session.send("Summarize the limitations section.")
    """

    model_name: Optional[str] = None
    system_prompt: str = (
        "You are an assistant helping refine an existing LaTeX research handout. "
        "Only reference information present in the document unless explicitly asked "
        "to brainstorm new content."
    )
    context_tex: Optional[str] = None
    turns: List[ChatTurn] = field(default_factory=list)

    def _chat_model(self):
        return llm_registry.get_chat_model(self.model_name)

    def _context_blob(self) -> str:
        if not self.context_tex:
            return ""
        try:
            with open(self.context_tex, "r", encoding="utf-8") as handle:
                return handle.read()
        except OSError:
            return ""

    def send(self, user_message: str) -> str:
        model = self._chat_model()
        messages = []
        if self.system_prompt:
            messages.append({"role": "system", "content": self.system_prompt})
        if self.context_tex:
            doc = self._context_blob()
            messages.append(
                {
                    "role": "system",
                    "content": "Document Context:\n" + doc[:6000],
                }
            )
        for turn in self.turns:
            messages.append({"role": turn.role, "content": turn.content})
        messages.append({"role": "user", "content": user_message})

        response = model.invoke(messages)
        reply_text = getattr(response, "content", str(response))
        self.turns.append(ChatTurn(role="user", content=user_message))
        self.turns.append(ChatTurn(role="assistant", content=reply_text))
        return reply_text


@dataclass
class RetrievalAugmentedChat:
    """
    Retrieval augmented chat session inspired by the 06_chat notebook.

    Usage:
        rag = RetrievalAugmentedChat.from_directory(Path(\"docs\"), model_name=\"ollama:llama3\")
        answer, sources = rag.ask(\"Summarize LangGraph\")  # returns answer + supporting chunks
    """

    retriever_chain: ConversationalRetrievalChain
    chat_history: List[Tuple[str, str]] = field(default_factory=list)

    @classmethod
    def from_directory(
        cls,
        directory: Path,
        glob: str = "**/*",
        model_name: Optional[str] = None,
        embedding_model: Optional[str] = None,
        chunk_size: int = 1000,
        chunk_overlap: int = 150,
        search_k: int = 4,
    ) -> "RetrievalAugmentedChat":
        docs = load_directory(directory, glob=glob)
        if not docs:
            raise ValueError(f"No documents found in {directory} matching {glob}.")
        chunks = split_documents(docs, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        vectorstore = build_vectorstore(chunks, embedding_model=embedding_model)
        retriever = vectorstore.as_retriever(search_kwargs={"k": search_k})
        llm = llm_registry.get_chat_model(model_name)
        chain = ConversationalRetrievalChain.from_llm(
            llm=llm,
            retriever=retriever,
            return_source_documents=True,
        )
        return cls(retriever_chain=chain)

    def ask(self, question: str) -> Tuple[str, List[str]]:
        payload = {"question": question, "chat_history": self.chat_history}
        result = self.retriever_chain(payload)
        answer = result.get("answer", "")
        sources = [
            doc.metadata.get("source", "")
            for doc in result.get("source_documents", []) or []
        ]
        self.chat_history.append((question, answer))
        return answer, sources

    def export_history(self, path: Path) -> None:
        data = [{"question": q, "answer": a} for q, a in self.chat_history]
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")
