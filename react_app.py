"""FastAPI backend for the React UI with PostgreSQL-backed topics/sections."""

from __future__ import annotations

import html
import os
import re
import json
import textwrap
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple

import difflib
import json

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlmodel import Field, Session, SQLModel, create_engine, select

from llm import llm_registry
from pipeline import ResearchPipeline, slugify
from ui import ResearchChatSession
from media_agent import MediaGenerationAgent, MediaSpec
from tools import (
    internet_search,
    wikipedia_lookup,
    arxiv_search,
    picsart_generate,
    picsart_upscale,
    picsart_remove_background,
)

SECTION_PATTERN = re.compile(
    r"\\section\{([^}]*)\}(.*?)(?=\\section\{|\\end\{document\})",
    re.S,
)

DIFF_CSS = """
<style>
.diff-table table {
  width: 100%;
  border-collapse: collapse;
  font-family: monospace;
  font-size: 0.85rem;
}
.diff-table td, .diff-table th {
  border: 1px solid #ddd;
  padding: 0.35rem 0.5rem;
  vertical-align: top;
}
.diff-table .diff_add {
  background: #e6ffed;
}
.diff-table .diff_sub {
  background: #ffeef0;
}
.diff-table .diff_chg {
  background: #fff5b1;
}
</style>
"""

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./deepagents.db")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)
media_generator = MediaGenerationAgent(output_root="results")


class Topic(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    slug: str = Field(index=True, unique=True)
    title: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = Field(default="draft")


class Section(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    topic_id: int = Field(foreign_key="topic.id")
    order_index: int
    title: str
    html_content: str
    approved_html: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SectionVersion(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    section_id: int = Field(foreign_key="section.id")
    label: str = Field(default="working")
    html_content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


SQLModel.metadata.create_all(engine)


def _timestamp() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


def _read_file(path: str) -> str:
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    return file_path.read_text(encoding="utf-8")


def _slug_from_identifier(identifier: str) -> str:
    ident = identifier.strip()
    if ident.startswith("topic:"):
        ident = ident.split(":", 1)[1]
    if "/" in ident or ident.endswith(".tex"):
        ident = Path(ident).stem
    return slugify(ident)


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text)


def _normalize_text(text: str) -> str:
    text = _strip_html(text)
    text = re.sub(r"\\cite\{[^}]*\}", "", text)
    text = re.sub(r"\\textbf\{([^}]*)\}", r"\1", text)
    text = re.sub(r"\\texttt\{([^}]*)\}", r"\1", text)
    text = re.sub(r"\\emph\{([^}]*)\}", r"\1", text)
    text = re.sub(r"\\subsection\{([^}]*)\}", r"\n\n\1\n\n", text)
    text = re.sub(r"\\subsubsection\{([^}]*)\}", r"\n\n\1\n\n", text)
    text = re.sub(r"\\begin\{(itemize|enumerate)\}|\\end\{(itemize|enumerate)\}", "\n\n", text)
    text = text.replace("\\item", "- ")
    text = text.replace("\\&", "&")
    text = text.replace("{", "").replace("}", "")
    return text


def _paragraphs_from_text(text: str) -> List[str]:
    normalized = _normalize_text(text)
    paragraphs = [
        para.strip()
        for para in re.split(r"\n\s*\n", normalized)
        if para.strip()
    ]
    return paragraphs or ["(No content detected in this section.)"]


_RAW_HTML_PREFIXES = ("<figure", "<img", "<iframe", "<video", "<svg", "<table", "<div")


def _looks_like_html_fragment(text: str) -> bool:
    stripped = text.strip()
    if not stripped.startswith("<"):
        return False
    lowered = stripped.lower()
    return any(lowered.startswith(prefix) for prefix in _RAW_HTML_PREFIXES)


def _paragraphs_to_html(paragraphs: List[str], section_id: str) -> str:
    snippets: List[str] = []
    for idx, para in enumerate(paragraphs, start=1):
        if _looks_like_html_fragment(para):
            snippets.append(
                f"<div id='{section_id}-p{idx}' class='para html-fragment'>"
                f"<span class='para-index'>({idx})</span> {para.strip()}</div>"
            )
            continue
        para_html = html.escape(para)
        snippets.append(
            f"<p id='{section_id}-p{idx}'><span class='para-index'>({idx})</span> {para_html}</p>"
        )
    return "\n".join(snippets)


def parse_sections(latex_text: str) -> List[Dict[str, str]]:
    sections: List[Dict[str, str]] = []
    for index, match in enumerate(SECTION_PATTERN.finditer(latex_text), start=1):
        title = match.group(1).strip()
        body = match.group(2)
        paragraphs = _paragraphs_from_text(body)
        html_block = _paragraphs_to_html(paragraphs, f"section{index}")
        sections.append(
            {
                "index": index,
                "title": title or f"Section {index}",
                "html": html_block,
            }
        )
    return sections


def render_document_html(sections: Iterable[Tuple[int, str, str]]) -> str:
    blocks = [
        "<style>.para-index{font-weight:bold;margin-right:6px;color:#2563eb;} .section-block{margin-bottom:1.5rem;} .section-block h2{margin-bottom:0.5rem;}</style>"
    ]
    for index, title, html_block in sections:
        blocks.append(
            f"<div class='section-block'><h2>{index}. {html.escape(title)}</h2>{html_block}</div>"
        )
    return "\n".join(blocks) if blocks else "<p><em>No sections detected.</em></p>"


def compute_diff_html(primary_text: str, compare_text: str) -> str:
    if not primary_text or not compare_text:
        return "<p><em>Provide both original and working documents to view the diff.</em></p>"
    primary_lines = _normalize_text(primary_text).splitlines()
    compare_lines = _normalize_text(compare_text).splitlines()
    differ = difflib.HtmlDiff(wrapcolumn=90)
    table = differ.make_table(
        primary_lines,
        compare_lines,
        fromdesc="Original",
        todesc="Working",
        context=True,
        numlines=1,
    )
    return DIFF_CSS + "<div class='diff-table'>" + table + "</div>"


def section_diff_html(
    section_index: int,
    working_sections: List[Dict[str, str]],
    original_sections: List[Dict[str, str]],
) -> str:
    try:
        working = next(sec for sec in working_sections if sec["index"] == section_index)
    except StopIteration:
        return "<p><em>Working section not found.</em></p>"
    try:
        original = next(sec for sec in original_sections if sec["index"] == section_index)
    except StopIteration:
        return "<p><em>Original section not available for diff.</em></p>"
    return compute_diff_html(original.get("html", ""), working.get("html", ""))


def sections_from_latex(latex_text: str) -> List[Dict[str, str]]:
    parsed = parse_sections(latex_text)
    if parsed:
        return parsed
    # fallback single section
    return [
        {
            "index": 1,
            "title": "Document",
            "html": _paragraphs_to_html(_paragraphs_from_text(latex_text), "section1"),
        }
    ]


def store_topic_sections(topic_name: str, latex_text: str) -> Topic:
    slug = slugify(topic_name)
    sections_data = sections_from_latex(latex_text)
    with Session(engine) as session:
        topic = session.exec(select(Topic).where(Topic.slug == slug)).one_or_none()
        if not topic:
            topic = Topic(slug=slug, title=topic_name)
            session.add(topic)
            session.commit()
            session.refresh(topic)
        else:
            topic.title = topic_name
            topic.updated_at = datetime.utcnow()
            session.add(topic)
            session.commit()
        existing_sections = session.exec(select(Section).where(Section.topic_id == topic.id)).all()
        for sec in existing_sections:
            versions = session.exec(
                select(SectionVersion).where(SectionVersion.section_id == sec.id)
            ).all()
            for ver in versions:
                session.delete(ver)
            session.delete(sec)
        session.commit()
        for order, data in enumerate(sections_data, start=1):
            new_section = Section(
                topic_id=topic.id,
                order_index=order,
                title=data["title"],
                html_content=data["html"],
                approved_html=data["html"],
            )
            session.add(new_section)
            session.commit()
            session.refresh(new_section)
            session.add(
                SectionVersion(
                    section_id=new_section.id,
                    label="initial",
                    html_content=new_section.html_content,
                )
            )
        session.commit()
        return topic


def topic_sections(topic: Topic, session: Session) -> List[Section]:
    return session.exec(
        select(Section).where(Section.topic_id == topic.id).order_by(Section.order_index)
    ).all()


def sections_payload(sections: List[Section], use_approved: bool = False) -> List[Dict[str, str]]:
    payload: List[Dict[str, str]] = []
    for sec in sections:
        html_text = sec.approved_html if use_approved and sec.approved_html else sec.html_content
        payload.append(
            {
                "index": sec.order_index,
                "title": sec.title,
                "body": html_text,
                "html": html_text,
            }
        )
    return payload


def build_outline_text(sections: List[Section]) -> str:
    return "\n".join(f"{sec.order_index}. {sec.title}" for sec in sections)


def get_section_html(sections: List[Section], target_index: Optional[int]) -> str:
    if not sections:
        return ""
    if target_index is None:
        return sections[0].html_content
    for sec in sections:
        if sec.order_index == target_index:
            return sec.html_content
    return sections[0].html_content


def _coerce_filename(slug: str, suffix: str = "diagram.png") -> str:
    safe_slug = slugify(slug or "diagram")
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    return f"{safe_slug}_{timestamp}_{suffix}"


def plan_diagram_spec(
    description: str,
    outline_text: str,
    section_html: str,
    slug: str,
    model_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Use the active LLM to translate a free-form prompt into a diagram spec."""
    model = llm_registry.get_chat_model(model_name or None)
    planner_prompt = textwrap.dedent(
        f"""
        You are a planning assistant that converts natural language diagram requests
        into JSON specs. Each spec MUST be valid JSON with the following keys:
        title (string), description (string), nodes (list of strings), edges (list of [source, target]),
        filename (string ending in .png), width (int), height (int).

        Consider the document outline:
        {outline_text or 'N/A'}

        Consider the current section HTML:
        {section_html[:1500]}

        Request: {description}

        Respond with JSON only.
        """
    ).strip()
    response = model.invoke(
        [
            {"role": "system", "content": "You produce JSON specs for diagrams with nodes and edges."},
            {"role": "user", "content": planner_prompt},
        ]
    )
    content = getattr(response, "content", str(response)).strip()
    try:
        spec_dict = json.loads(content)
    except json.JSONDecodeError:
        spec_dict = {
            "title": description[:60] or "Auto Diagram",
            "description": "Auto-generated diagram",
            "nodes": ["Input", "Processing", "Output"],
            "edges": [["Input", "Processing"], ["Processing", "Output"]],
            "filename": _coerce_filename(slug),
            "width": 1280,
            "height": 720,
        }
    if "filename" not in spec_dict:
        spec_dict["filename"] = _coerce_filename(slug)
    spec_dict["nodes"] = _normalize_nodes(spec_dict.get("nodes"))
    spec_dict["edges"] = _normalize_edges(spec_dict.get("edges"))
    if not spec_dict["nodes"]:
        spec_dict["nodes"] = ["Agent", "Tooling", "Output"]
    if not spec_dict["edges"]:
        spec_dict["edges"] = [[spec_dict["nodes"][0], spec_dict["nodes"][-1]]]
    spec_dict["width"] = int(spec_dict.get("width", 1280) or 1280)
    spec_dict["height"] = int(spec_dict.get("height", 720) or 720)
    spec_dict.setdefault("kind", "diagram")
    return spec_dict


def _normalize_nodes(raw: Any) -> List[str]:
    if not raw:
        return []
    if isinstance(raw, str):
        parts = re.split(r"[,;\n]+", raw)
        return [part.strip() for part in parts if part.strip()]
    nodes: List[str] = []
    for item in raw:
        text = str(item).strip()
        if text:
            nodes.append(text)
    return nodes


def _normalize_edges(raw: Any) -> List[List[str]]:
    if not raw:
        return []
    edges: List[List[str]] = []
    if isinstance(raw, str):
        raw_list = re.split(r"[\n;]+", raw)
    else:
        raw_list = raw
    for item in raw_list:
        if isinstance(item, (list, tuple)):
            if len(item) >= 2:
                a = str(item[0]).strip()
                b = str(item[1]).strip()
                if a and b:
                    edges.append([a, b])
        else:
            text = str(item).strip()
            if not text:
                continue
            if "->" in text:
                parts = [p.strip() for p in text.split("->", 1)]
            elif "-" in text:
                parts = [p.strip() for p in text.split("-", 1)]
            elif "," in text:
                parts = [p.strip() for p in text.split(",", 1)]
            else:
                parts = []
            if len(parts) >= 2 and parts[0] and parts[1]:
                edges.append(parts[:2])
    return edges


def format_search_results(payload: Dict[str, Any]) -> str:
    """Convert Tavily-style payloads into a readable snippet."""
    if not payload:
        return "No search results."
    results = payload.get("results") or []
    if not results:
        return "No search results."
    formatted: List[str] = []
    for idx, item in enumerate(results[:5], start=1):
        title = item.get("title") or f"Result {idx}"
        url = item.get("url") or ""
        content = (item.get("content") or "").strip()
        formatted.append(f"{idx}. {title}\n{url}\n{content}")
    return "\n\n".join(formatted)


def build_session_response(topic: Topic, session: Session) -> Dict:
    sections = topic_sections(topic, session)
    working_payload = sections_payload(sections)
    original_payload = sections_payload(sections, use_approved=True)
    diff_html = (
        section_diff_html(working_payload[0]["index"], working_payload, original_payload)
        if working_payload
        else "<p><em>No sections available.</em></p>"
    )
    working_html = render_document_html(
        (sec["index"], sec["title"], sec["html"]) for sec in working_payload
    )
    original_html = render_document_html(
        (sec["index"], sec["title"], sec["html"]) for sec in original_payload
    )
    versions = session.exec(
        select(SectionVersion, Section)
        .join(Section, SectionVersion.section_id == Section.id)
        .where(Section.topic_id == topic.id)
        .order_by(SectionVersion.created_at.desc())
    ).all()
    working_versions = [
        {
            "name": f"{sec.title} ({ver.label})",
            "timestamp": ver.created_at.strftime("%Y-%m-%d %H:%M"),
        }
        for ver, sec in versions
    ]
    return {
        "context_path": topic.slug,
        "sections": working_payload,
        "original_sections": original_payload,
        "sections_html": working_html,
        "original_html": original_html,
        "diff_html": diff_html,
        "working_versions": working_versions,
        "original_versions": [
            {
                "name": "Approved Baseline",
                "timestamp": topic.updated_at.strftime("%Y-%m-%d %H:%M"),
            }
        ],
    }


class ResolveTopicRequest(BaseModel):
    topic: str


class GenerateTopicRequest(BaseModel):
    topic: str
    model_name: Optional[str] = None


class InitSessionRequest(BaseModel):
    context_path: str


class SaveSectionRequest(BaseModel):
    context_path: str
    section_index: int
    new_body: str


class SectionDiffRequest(BaseModel):
    context_path: str
    section_index: int


class LLMRewriteRequest(BaseModel):
    context_path: str
    section_index: int
    instruction: Optional[str] = None
    model_name: Optional[str] = None


class PromoteRequest(BaseModel):
    context_path: str
    section_index: int


class RegenerateRequest(BaseModel):
    topic: str
    model_name: Optional[str] = None


class RenderSectionRequest(BaseModel):
    body: str


class ChatMessagePayload(BaseModel):
    role: Literal["user", "assistant", "tool", "system"]
    content: str
    tool_name: Optional[str] = None


class SectionChatRequest(BaseModel):
    context_path: str
    section_index: Optional[int] = None
    model_name: Optional[str] = None
    messages: List[ChatMessagePayload]


class ToolRunRequest(BaseModel):
    context_path: Optional[str] = None
    section_index: Optional[int] = None
    model_name: Optional[str] = None
    tool: Literal[
        "internet_search",
        "wikipedia_lookup",
        "arxiv_search",
        "diagram",
        "planning_deepagent",
    ]
    query: str


class DeepAgentEditRequest(BaseModel):
    context_path: str
    section_index: int
    message: str
    model_name: Optional[str] = None


app = FastAPI(title="DeepAgents React API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
results_dir = Path("results").resolve()
if results_dir.exists():
    app.mount("/results", StaticFiles(directory=str(results_dir)), name="results")


@app.get("/topics")
def list_topics() -> Dict[str, List[str]]:
    with Session(engine) as session:
        rows = session.exec(select(Topic.slug).order_by(Topic.slug)).all()
    return {"topics": rows}


@app.post("/topics/resolve")
def resolve_topic(payload: ResolveTopicRequest) -> Dict[str, str]:
    slug = slugify(payload.topic)
    with Session(engine) as session:
        topic = session.exec(select(Topic).where(Topic.slug == slug)).one_or_none()
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found.")
    return {"context_path": slug, "message": f"Resolved topic '{payload.topic}'."}


@app.post("/topics/generate")
def generate_topic(payload: GenerateTopicRequest) -> Dict[str, str]:
    pipeline = ResearchPipeline(llm_name=payload.model_name or None, debug=False)
    result = pipeline.run(
        topic=payload.topic,
        llm_name=payload.model_name or None,
        workdir="results",
        compile_pdf=False,
    )
    latex_text = _read_file(result.tex_path)
    topic = store_topic_sections(payload.topic, latex_text)
    return {"context_path": topic.slug, "message": f"Generated '{payload.topic}'."}


@app.post("/session/init")
def init_session(payload: InitSessionRequest) -> Dict:
    slug = _slug_from_identifier(payload.context_path)
    with Session(engine) as session_db:
        topic = session_db.exec(select(Topic).where(Topic.slug == slug)).one_or_none()
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found.")
        response = build_session_response(topic, session_db)
    return response


@app.post("/section/save")
def save_section(payload: SaveSectionRequest) -> Dict:
    slug = _slug_from_identifier(payload.context_path)
    with Session(engine) as session_db:
        topic = session_db.exec(select(Topic).where(Topic.slug == slug)).one_or_none()
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found.")
        section = session_db.exec(
            select(Section)
            .where(Section.topic_id == topic.id, Section.order_index == payload.section_index)
        ).one_or_none()
        if not section:
            raise HTTPException(status_code=404, detail="Section not found.")
        section.html_content = payload.new_body
        section.updated_at = datetime.utcnow()
        session_db.add(section)
        session_db.add(
            SectionVersion(section_id=section.id, label="working", html_content=payload.new_body)
        )
        session_db.commit()
        response = build_session_response(topic, session_db)
    return response


@app.post("/section/diff")
def section_diff(payload: SectionDiffRequest) -> Dict[str, str]:
    slug = _slug_from_identifier(payload.context_path)
    with Session(engine) as session_db:
        topic = session_db.exec(select(Topic).where(Topic.slug == slug)).one_or_none()
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found.")
        sections = topic_sections(topic, session_db)
    working_payload = sections_payload(sections)
    original_payload = sections_payload(sections, use_approved=True)
    return {
        "diff_html": section_diff_html(
            payload.section_index,
            working_payload,
            original_payload,
        )
    }


@app.post("/section/chat")
def section_chat(payload: SectionChatRequest) -> Dict[str, str]:
    slug = _slug_from_identifier(payload.context_path)
    with Session(engine) as session_db:
        topic = session_db.exec(select(Topic).where(Topic.slug == slug)).one_or_none()
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found.")
        sections = topic_sections(topic, session_db)
    outline_text = build_outline_text(sections)
    section_html = get_section_html(sections, payload.section_index)
    model = llm_registry.get_chat_model(payload.model_name or None)
    system_prompt = textwrap.dedent(
        f"""
        You are collaborating with a critique agent to refine a research document.
        Stay consistent with the provided outline and section HTML.

        Outline:
        {outline_text or 'No outline available.'}

        Current section HTML:
        {section_html[:2000] or '<empty>'}
        """
    ).strip()
    messages = [{"role": "system", "content": system_prompt}]
    for msg in payload.messages[-20:]:
        role = "assistant" if msg.role == "tool" else msg.role
        content = msg.content
        if msg.tool_name:
            content = f"[Tool: {msg.tool_name}]\n{content}"
        messages.append({"role": role, "content": content})
    response = model.invoke(messages)
    reply = getattr(response, "content", str(response)).strip()
    if not reply:
        reply = "I do not have new suggestions yet. Could you provide more context?"
    return {"message": reply}


@app.post("/section/llm_rewrite")
def llm_rewrite(payload: LLMRewriteRequest) -> Dict[str, str]:
    slug = _slug_from_identifier(payload.context_path)
    with Session(engine) as session_db:
        topic = session_db.exec(select(Topic).where(Topic.slug == slug)).one_or_none()
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found.")
        section = session_db.exec(
            select(Section)
            .where(Section.topic_id == topic.id, Section.order_index == payload.section_index)
        ).one_or_none()
        if not section:
            raise HTTPException(status_code=404, detail="Section not found.")
    model = llm_registry.get_chat_model(payload.model_name or None)
    directive = payload.instruction.strip() if payload.instruction else "Improve clarity and readability."
    prompt = (
        "You are editing a research document stored as HTML. Rewrite the body below according to the user request."
        " Return pure HTML without surrounding <html> tags."
        "\n\nUser request: "
        f"{directive}\n\nCurrent HTML:\n--------------------\n{section.html_content}\n--------------------\n"
    )
    response = model.invoke(
        [
            {"role": "system", "content": "You are a meticulous editor."},
            {"role": "user", "content": prompt},
        ]
    )
    new_text = getattr(response, "content", str(response)).strip()
    if not new_text:
        raise HTTPException(status_code=500, detail="LLM returned no content.")
    return {"body": new_text}


@app.post("/section/tool")
def run_section_tool(payload: ToolRunRequest) -> Dict[str, str]:
    slug = _slug_from_identifier(payload.context_path) if payload.context_path else None
    if payload.tool == "internet_search":
        results = internet_search(payload.query, max_results=5)
        return {
            "tool_name": "internet_search",
            "content": format_search_results(results),
        }
    if payload.tool == "wikipedia_lookup":
        summary = wikipedia_lookup(payload.query)
        return {"tool_name": "wikipedia_lookup", "content": summary}
    if payload.tool == "arxiv_search":
        summary = arxiv_search(payload.query, max_results=3)
        return {"tool_name": "arxiv_search", "content": summary}
    if payload.tool == "diagram":
        if not slug:
            raise HTTPException(status_code=400, detail="Diagram generation requires a context path.")
        with Session(engine) as session_db:
            topic = session_db.exec(select(Topic).where(Topic.slug == slug)).one_or_none()
            if not topic:
                raise HTTPException(status_code=404, detail="Topic not found.")
            sections = topic_sections(topic, session_db)
        outline_text = build_outline_text(sections)
        section_html = get_section_html(sections, payload.section_index)
        spec_dict = plan_diagram_spec(
            payload.query,
            outline_text,
            section_html,
            slug,
            payload.model_name,
        )
        spec_dict.setdefault("kind", "diagram")
        spec_dict.setdefault("width", 1280)
        spec_dict.setdefault("height", 720)
        spec = MediaSpec.from_dict(spec_dict)
        output_path = media_generator.generate(spec, topic_slug=slug)
        try:
            relative_path = output_path.relative_to(Path.cwd())
        except ValueError:
            relative_path = output_path
        snippet = (
            f'<figure><img src="{relative_path}" alt="{spec.title or "Diagram"}" />'
            f'<figcaption>{spec.description or ""}</figcaption></figure>'
        )
        message = (
            f"Diagram '{spec.title or 'Architecture Diagram'}' created at {relative_path}."
            " Reference snippet:\n"
            f"{snippet}"
        )
        return {
            "tool_name": "diagram",
            "content": message,
            "asset_path": str(relative_path),
            "snippet": snippet,
        }
    if payload.tool == "planning_deepagent":
        if not slug:
            raise HTTPException(status_code=400, detail="Planning assistant requires a context path.")
        with Session(engine) as session_db:
            topic = session_db.exec(select(Topic).where(Topic.slug == slug)).one_or_none()
            if not topic:
                raise HTTPException(status_code=404, detail="Topic not found.")
            sections = topic_sections(topic, session_db)
        outline_text = build_outline_text(sections)
        section_html = get_section_html(sections, payload.section_index)
        planner = llm_registry.get_chat_model(payload.model_name or None)
        planning_prompt = textwrap.dedent(
            f"""
            You are the Planning DeepAgent. When the editor is unsure how to proceed,
            you must analyze the conversation, the outline, and the current section
            to produce an actionable plan.

            Outline:
            {outline_text or 'N/A'}

            Section excerpt:
            {section_html[:2000] or '<empty>'}

            User query or issue:
            {payload.query}

            Respond with:
            1. A short assessment of the situation.
            2. A numbered list of concrete next steps (mention tools or data to gather).
            3. Any risks or clarifying questions.
            """
        ).strip()
        response = planner.invoke(
            [
                {"role": "system", "content": "You are the Planning DeepAgent that unblocks other agents."},
                {"role": "user", "content": planning_prompt},
            ]
        )
        content = getattr(response, "content", str(response)).strip() or "Planning agent could not produce guidance."
        return {
            "tool_name": "planning_deepagent",
            "content": content,
        }
    raise HTTPException(status_code=400, detail=f"Unsupported tool '{payload.tool}'.")


@app.post("/section/deepagent_edit")
def deepagent_edit(payload: DeepAgentEditRequest) -> Dict[str, str]:
    slug = _slug_from_identifier(payload.context_path)
    with Session(engine) as session_db:
        topic = session_db.exec(select(Topic).where(Topic.slug == slug)).one_or_none()
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found.")
        section = session_db.exec(
            select(Section)
            .where(Section.topic_id == topic.id, Section.order_index == payload.section_index)
        ).one_or_none()
        if not section:
            raise HTTPException(status_code=404, detail="Section not found.")
        sections = topic_sections(topic, session_db)
    outline_text = build_outline_text(sections)
    section_html = section.html_content
    model = llm_registry.get_chat_model(payload.model_name or None)
    directive = payload.message.strip()
    if not directive:
        raise HTTPException(status_code=400, detail="Provide an instruction for the DeepAgent.")
    user_prompt = textwrap.dedent(
        f"""
        You are DeepAgents' autonomous editor. The user wants to modify a specific section.
        1. Review the outline and current section HTML.
        2. Apply the user's request.
        3. Respond with JSON: {{"message": "<summary>", "html": "<updated HTML>"}}.

        Outline:
        {outline_text or 'N/A'}

        Current section HTML:
        {section_html[:4000]}

        User request:
        {directive}
        """
    ).strip()
    response = model.invoke(
        [
            {"role": "system", "content": "You are DeepAgents' planning and editing agent."},
            {"role": "user", "content": user_prompt},
        ]
    )
    content = getattr(response, "content", str(response)).strip()
    try:
        payload_json = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="DeepAgent returned an unexpected format. Please try again with more detail.",
        )
    new_html = payload_json.get("html", "").strip()
    if not new_html:
        raise HTTPException(status_code=500, detail="DeepAgent did not return updated HTML.")
    message = payload_json.get("message", "DeepAgent applied your request.")
    return {"message": message, "html": new_html}


@app.post("/document/promote")
def promote_document(payload: PromoteRequest) -> Dict:
    slug = _slug_from_identifier(payload.context_path)
    with Session(engine) as session_db:
        topic = session_db.exec(select(Topic).where(Topic.slug == slug)).one_or_none()
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found.")
        section = session_db.exec(
            select(Section)
            .where(Section.topic_id == topic.id, Section.order_index == payload.section_index)
        ).one_or_none()
        if not section:
            raise HTTPException(status_code=404, detail="Section not found.")
        section.approved_html = section.html_content
        section.updated_at = datetime.utcnow()
        session_db.add(section)
        session_db.add(
            SectionVersion(section_id=section.id, label="approved", html_content=section.html_content)
        )
        topic.updated_at = datetime.utcnow()
        session_db.add(topic)
        session_db.commit()
        response = build_session_response(topic, session_db)
    return response


@app.post("/document/regenerate")
def regenerate(payload: RegenerateRequest) -> Dict:
    pipeline = ResearchPipeline(llm_name=payload.model_name or None, debug=False)
    result = pipeline.run(
        topic=payload.topic,
        llm_name=payload.model_name or None,
        workdir="results",
        compile_pdf=False,
    )
    latex_text = _read_file(result.tex_path)
    topic = store_topic_sections(payload.topic, latex_text)
    with Session(engine) as session_db:
        topic = session_db.exec(select(Topic).where(Topic.id == topic.id)).one()
        response = build_session_response(topic, session_db)
        response["message"] = f"Re-generated '{payload.topic}' using {result.model_name}."
    return response


@app.post("/section/render")
def render_section_html(payload: RenderSectionRequest) -> Dict[str, str]:
    paragraphs = _paragraphs_from_text(payload.body)
    html_fragment = _paragraphs_to_html(paragraphs, "preview")
    return {"html": html_fragment}


# ========== BookApp Standalone Endpoints ==========

class BookChatRequest(BaseModel):
    messages: List[ChatMessagePayload]
    context: Optional[str] = None  # Optional book/chapter context
    model_name: Optional[str] = None


class BookExportRequest(BaseModel):
    format: Literal["pdf", "docx", "epub"]
    chapters: List[Dict[str, Any]]


class BookSaveRequest(BaseModel):
    chapters: List[Dict[str, Any]]
    annotations: Optional[List[Dict[str, Any]]] = None


@app.post("/book/chat")
def book_chat(payload: BookChatRequest) -> Dict[str, str]:
    """Standalone chat endpoint for BookApp without topic context."""
    model = llm_registry.get_chat_model(payload.model_name or None)
    system_prompt = textwrap.dedent(
        """
        You are a helpful AI writing assistant for a book authoring application.
        Help the user with rewrites, expansions, summaries, critiques, and creative suggestions.
        Be concise but helpful. Format your responses with clear structure when appropriate.
        """
    ).strip()
    if payload.context:
        system_prompt += f"\n\nCurrent context:\n{payload.context[:2000]}"
    
    messages = [{"role": "system", "content": system_prompt}]
    for msg in payload.messages[-20:]:
        role = "assistant" if msg.role == "tool" else msg.role
        content = msg.content
        if msg.tool_name:
            content = f"[Tool: {msg.tool_name}]\n{content}"
        messages.append({"role": role, "content": content})
    
    response = model.invoke(messages)
    reply = getattr(response, "content", str(response)).strip()
    if not reply:
        reply = "I'm ready to help. Could you provide more context about what you'd like me to do?"
    return {"message": reply}


@app.post("/book/save")
def book_save(payload: BookSaveRequest) -> Dict[str, str]:
    """Save book chapters (placeholder - stores in memory/file for now)."""
    # For now, just acknowledge. In production, persist to database.
    chapter_count = len(payload.chapters)
    return {"message": f"Saved {chapter_count} chapter(s) successfully."}


@app.post("/book/export")
def book_export(payload: BookExportRequest) -> Dict[str, str]:
    """Export book to PDF/DOCX/EPUB (placeholder)."""
    # For now, return a placeholder. In production, generate actual file.
    format_name = payload.format.upper()
    chapter_count = len(payload.chapters)
    return {
        "url": f"/exports/book.{payload.format}",
        "message": f"Exported {chapter_count} chapter(s) to {format_name}."
    }


@app.post("/book/suggest")
def book_suggest(payload: BookChatRequest) -> Dict[str, str]:
    """Generate a writing suggestion based on context."""
    model = llm_registry.get_chat_model(payload.model_name or None)
    system_prompt = textwrap.dedent(
        """
        You are a writing assistant. Based on the user's request, provide a concise, 
        actionable suggestion for improving or expanding their text.
        Keep suggestions to 2-3 sentences maximum.
        """
    ).strip()
    if payload.context:
        system_prompt += f"\n\nContext:\n{payload.context[:1500]}"
    
    messages = [{"role": "system", "content": system_prompt}]
    for msg in payload.messages[-5:]:
        role = "assistant" if msg.role == "tool" else msg.role
        messages.append({"role": role, "content": msg.content})
    
    response = model.invoke(messages)
    reply = getattr(response, "content", str(response)).strip()
    return {"body": reply}


class PicsartGenerateRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = ""
    width: int = 1024
    height: int = 1024


class PicsartUpscaleRequest(BaseModel):
    image_url: str
    upscale_factor: int = 2


@app.post("/book/image/generate")
def book_image_generate(payload: PicsartGenerateRequest) -> Dict[str, Any]:
    """Generate an AI image using Picsart for book illustrations."""
    result = picsart_generate(
        prompt=payload.prompt,
        negative_prompt=payload.negative_prompt or "",
        width=payload.width,
        height=payload.height,
        output_dir="results/book_images",
    )
    return result


@app.post("/book/image/upscale")
def book_image_upscale(payload: PicsartUpscaleRequest) -> Dict[str, Any]:
    """Upscale an image using Picsart."""
    # Download the image first if it's a URL
    import tempfile
    import urllib.request
    
    try:
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            urllib.request.urlretrieve(payload.image_url, tmp.name)
            result = picsart_upscale(
                image_path=tmp.name,
                upscale_factor=payload.upscale_factor,
                output_dir="results/book_images",
            )
            os.unlink(tmp.name)
            return result
    except Exception as e:
        return {"status": "error", "message": str(e), "url": "", "local_path": ""}


class DeepSearchRequest(BaseModel):
    """Request body for intelligent multi-source search."""
    query: str
    max_results: Optional[int] = 5


@app.post("/book/search")
def book_search(payload: DeepSearchRequest) -> Dict[str, Any]:
    """
    Intelligent multi-source search using deep_router to decide which tools to use.
    Aggregates results from Wikipedia, arXiv, Perplexity, and web search based on query context.
    """
    from tools import deep_search
    result = deep_search(
        query=payload.query,
        max_results=payload.max_results or 5,
    )
    return result


@app.options("/book/search")
def book_search_options() -> Response:
    """Handle CORS preflight checks for /book/search."""
    return Response(status_code=200)
