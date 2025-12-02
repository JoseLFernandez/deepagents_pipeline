"""Gradio UI for reviewing LaTeX handouts with paragraph-level comments."""

from __future__ import annotations

import html
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import difflib
from datetime import datetime

import gradio as gr

from llm import llm_registry
from pipeline import slugify, ResearchPipeline
from ui import ResearchChatSession

DEFAULT_TOPIC = "Agentic Security"
DEFAULT_CONTEXT = "results/agentic_security/agentic_security.tex"

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



def _read_file(path: Optional[str]) -> str:
    if not path:
        return ""
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"Context file not found: {path}")
    return file_path.read_text(encoding="utf-8")


def _normalize_latex(text: str) -> str:
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
    normalized = _normalize_latex(text)
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
                "id": f"section{index}",
                "title": title or f"Section {index}",
                "paragraphs": paragraphs,
                "html": html_block,
                "body": body,
                "body_start": match.start(2),
                "body_end": match.end(2),
            }
        )
    return sections


def render_document_html(sections: List[Dict[str, str]]) -> str:
    if not sections:
        return "<p><em>No sections detected in this document.</em></p>"
    blocks = [
        "<style>.para-index{font-weight:bold;margin-right:6px;color:#2563eb;} .section-block{margin-bottom:1.5rem;} .section-block h2{margin-bottom:0.5rem;}</style>"
    ]
    for section in sections:
        blocks.append(
            f"<div class='section-block'><h2>{html.escape(section['title'])}</h2>{section['html']}</div>"
        )
    return "\n".join(blocks)


def resolve_topic_path(topic: str) -> Tuple[str, str]:
    topic = topic.strip()
    if not topic:
        raise gr.Error("Please enter a topic first.")
    slug = slugify(topic)
    candidate = Path("results") / slug / f"{slug}.tex"
    if not candidate.exists():
        return "", f"Topic '{topic}' not found at {candidate}"
    return str(candidate), f"Resolved topic '{topic}' to {candidate}"


def _timestamp() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def format_version_history(history: List[Dict[str, str]]) -> List[List[str]]:
    rows = [
        [entry["name"], entry["timestamp"]]
        for entry in history
    ]
    return rows or [["(none recorded)", ""]]


def generate_topic(topic: str, model_name: str) -> Tuple[str, str]:
    topic = topic.strip()
    if not topic:
        raise gr.Error("Please enter a topic before generating.")
    pipeline = ResearchPipeline(llm_name=model_name or None, debug=False)
    result = pipeline.run(
        topic=topic,
        llm_name=model_name or None,
        workdir="results",
        compile_pdf=False,
    )
    return result.tex_path, (
        f"Generated topic '{topic}' with model '{result.model_name}'. "
        f"LaTeX saved to {result.tex_path}"
    )


def compute_diff_html(primary_text: str, compare_text: str) -> str:
    if not primary_text or not compare_text:
        return "<p><em>Provide both primary and comparison documents to see the diff.</em></p>"
    primary_lines = _normalize_latex(primary_text).splitlines()
    compare_lines = _normalize_latex(compare_text).splitlines()
    differ = difflib.HtmlDiff(wrapcolumn=90)
    table = differ.make_table(
        primary_lines,
        compare_lines,
        fromdesc="Primary",
        todesc="Comparison",
        context=True,
        numlines=1,
    )
    return DIFF_CSS + "<div class='diff-table'>" + table + "</div>"


def refresh_diff(primary_path: str, compare_path: str) -> str:
    try:
        primary = _read_file(primary_path.strip())
    except Exception:
        primary = ""
    try:
        compare = _read_file(compare_path.strip())
    except Exception:
        compare = ""
    return compute_diff_html(primary, compare)


def init_session(
    context_path: str,
    compare_path: str,
    model_name: str,
    system_prompt: str,
) -> Tuple[
    Optional[ResearchChatSession],
    str,
    str,
    gr.Dropdown,
    List[Dict[str, str]],
    str,
    str,
    gr.Dropdown,
    List[Dict[str, str]],
    gr.Dataframe,
    gr.Chatbot,
    str,
    str,
    str,
    List[Dict[str, str]],
    gr.Dataframe,
    List[Dict[str, str]],
    gr.Dataframe,
]:
    context_path = (context_path or "").strip()
    session = ResearchChatSession(
        model_name=model_name or None,
        system_prompt=system_prompt.strip(),
        context_tex=context_path or None,
    )
    status = "Session ready."
    sections: List[Dict[str, str]] = []
    latex_text = ""
    original_text = ""
    editor_text = ""
    document_html = "<p><em>No document loaded.</em></p>"
    original_html = "<p><em>No original baseline.</em></p>"
    section_dropdown = gr.update(choices=[], value=None)
    section_html = "<em>Select a section to view its paragraphs.</em>"
    paragraph_dropdown = gr.update(choices=[], value=None)
    diff_html = "<p><em>Provide both primary and original documents to view differences.</em></p>"
    working_versions: List[Dict[str, str]] = []
    original_versions: List[Dict[str, str]] = []
    original_sections: List[Dict[str, str]] = []
    try:
        latex_text = _read_file(context_path)
    except FileNotFoundError as exc:
        status = str(exc)
    except Exception as exc:  # pragma: no cover
        status = f"Failed to read document: {exc}"
    else:
        sections = parse_sections(latex_text)
        document_html = render_document_html(sections)
        if compare_path.strip():
            try:
                original_text = _read_file(compare_path.strip())
            except Exception as exc:
                status = f"Primary loaded but comparison failed: {exc}"
                original_text = latex_text
        else:
            original_text = latex_text
        original_sections = parse_sections(original_text)
        original_html = render_document_html(original_sections)
        diff_html = "<p><em>Select a section to view its diff.</em></p>"
        working_versions = [
            {"name": "Version 1 (initial)", "timestamp": _timestamp(), "text": latex_text}
        ]
        original_versions = [
            {"name": "Original baseline", "timestamp": _timestamp(), "text": original_text}
        ]
        if sections:
            first = sections[0]
            default_label = f"1. {sections[0]['title']}"
            section_dropdown = gr.update(
                choices=[f"{idx + 1}. {sec['title']}" for idx, sec in enumerate(sections)],
                value=default_label,
            )
            section_html = first["html"]
            editor_text = first["body"].strip()
            paragraph_dropdown = gr.update(
                choices=[str(i) for i in range(1, len(first["paragraphs"]) + 1)],
                value="1",
            )
            diff_html = section_diff_html(default_label, sections, original_sections)
        else:
            original_sections = []
    comments_state: List[Dict[str, str]] = []
    comments_table = gr.update(value=[], headers=["Section", "Paragraph", "Comment"])
    chat_reset = gr.update(value=[])
    return (
        session,
        status,
        document_html,
        section_dropdown,
        sections,
        latex_text,
        section_html,
        editor_text,
        paragraph_dropdown,
        comments_state,
        comments_table,
        chat_reset,
        diff_html,
        original_html,
        original_text,
        working_versions,
        gr.update(
            value=format_version_history(working_versions),
            headers=["Working Versions", "Timestamp"],
        ),
        original_versions,
        gr.update(
            value=format_version_history(original_versions),
            headers=["Original Versions", "Timestamp"],
        ),
        original_sections,
    )


def _find_section(selected: str, sections: List[Dict[str, str]]) -> Optional[Dict[str, str]]:
    if not selected:
        return None
    try:
        index_str, _ = selected.split(".", 1)
        index = int(index_str) - 1
    except Exception:
        return None
    if 0 <= index < len(sections):
        return sections[index]
    return None


def section_diff_html(
    selected: str,
    working_sections: List[Dict[str, str]],
    original_sections: List[Dict[str, str]],
) -> str:
    if not selected:
        return "<p><em>Select a section to view its diff.</em></p>"
    working = _find_section(selected, working_sections)
    original = _find_section(selected, original_sections)
    if not working:
        return "<p><em>Working section not found.</em></p>"
    if not original:
        return "<p><em>Original section not available for diff.</em></p>"
    return compute_diff_html(original.get("body", ""), working.get("body", ""))


def select_section(
    selected: str,
    sections: List[Dict[str, str]],
    original_sections: List[Dict[str, str]],
) -> Tuple[str, gr.Dropdown, str, str]:
    section = _find_section(selected, sections)
    if not section:
        return "<em>Select a valid section.</em>", gr.update(choices=[], value=None), "", "<p><em>No diff available.</em></p>"
    paragraph_choices = [str(i) for i in range(1, len(section["paragraphs"]) + 1)]
    diff_html = section_diff_html(selected, sections, original_sections)
    return section["html"], gr.update(
        choices=paragraph_choices,
        value=paragraph_choices[0] if paragraph_choices else None,
    ), section["body"].strip(), diff_html


def render_comments_table(comments: List[Dict[str, str]]) -> List[List[str]]:
    return [
        [comment["section"], comment["paragraph"], comment["text"]]
        for comment in comments
    ]


def add_comment(
    section_choice: str,
    paragraph_choice: str,
    comment_text: str,
    comments: List[Dict[str, str]],
    sections: List[Dict[str, str]],
) -> Tuple[str, gr.Dataframe, List[Dict[str, str]]]:
    if not comment_text.strip():
        raise gr.Error("Please enter a comment before submitting.")
    section = _find_section(section_choice, sections)
    if not section:
        raise gr.Error("Select a section before commenting.")
    try:
        paragraph_index = int(paragraph_choice)
    except Exception as exc:
        raise gr.Error("Paragraph selection is invalid.") from exc
    if paragraph_index < 1 or paragraph_index > len(section["paragraphs"]):
        raise gr.Error("Paragraph selection is out of range.")
    record = {
        "section": section_choice,
        "paragraph": str(paragraph_index),
        "text": comment_text.strip(),
    }
    updated_comments = comments + [record]
    table = gr.update(
        value=render_comments_table(updated_comments),
        headers=["Section", "Paragraph", "Comment"],
    )
    return "", table, updated_comments


def save_section_edit(
    section_choice: str,
    new_body: str,
    sections: List[Dict[str, str]],
    latex_text: str,
    context_path: str,
    original_text: str,
    working_history: List[Dict[str, str]],
    original_sections: List[Dict[str, str]],
) -> Tuple[
    str,
    str,
    gr.Dropdown,
    List[Dict[str, str]],
    str,
    str,
    gr.Dropdown,
    str,
    str,
    List[Dict[str, str]],
    gr.Dataframe,
]:
    if not section_choice:
        raise gr.Error("Select a section before saving edits.")
    if not latex_text:
        raise gr.Error("Load a document before editing.")
    section = _find_section(section_choice, sections)
    if not section:
        raise gr.Error("Selected section could not be found. Reinitialize and try again.")
    start = section.get("body_start")
    end = section.get("body_end")
    if start is None or end is None:
        raise gr.Error("Section boundaries are undefined; cannot save edits.")
    clean_body = new_body.strip()
    edited_body = "\n" + clean_body + "\n"
    new_latex = latex_text[:start] + edited_body + latex_text[end:]
    path = Path(context_path.strip())
    try:
        path.write_text(new_latex, encoding="utf-8")
    except Exception as exc:
        raise gr.Error(f"Failed to write LaTeX file: {exc}") from exc
    updated_sections = parse_sections(new_latex)
    document_html = render_document_html(updated_sections)
    choices = [f"{idx + 1}. {sec['title']}" for idx, sec in enumerate(updated_sections)]
    selected_label = section_choice if section_choice in choices else (choices[0] if choices else None)
    section_dropdown = gr.update(choices=choices, value=selected_label)
    selected_section = _find_section(selected_label, updated_sections) if selected_label else None
    section_html = selected_section["html"] if selected_section else "<em>Select a valid section.</em>"
    paragraph_dropdown = gr.update(
        choices=[str(i) for i in range(1, len(selected_section["paragraphs"]) + 1)] if selected_section else [],
        value="1" if selected_section and selected_section["paragraphs"] else None,
    )
    diff_html = section_diff_html(section_choice, updated_sections, original_sections)
    editor_text = selected_section["body"].strip() if selected_section else ""
    status = f"Saved edits to {selected_label or 'document'}."
    new_history = working_history + [
        {
            "name": f"Version {len(working_history) + 1}",
            "timestamp": _timestamp(),
            "text": new_latex,
        }
    ]
    history_table = gr.update(
        value=format_version_history(new_history),
        headers=["Working Versions", "Timestamp"],
    )
    return (
        status,
        document_html,
        section_dropdown,
        updated_sections,
        new_latex,
        section_html,
        paragraph_dropdown,
        diff_html,
        editor_text,
        new_history,
        history_table,
    )


def refresh_diff_state(
    section_choice: str,
    sections: List[Dict[str, str]],
    original_sections: List[Dict[str, str]],
) -> str:
    return section_diff_html(section_choice, sections, original_sections)


def snapshot_working_version(
    latex_text: str,
    history: List[Dict[str, str]],
) -> Tuple[List[Dict[str, str]], gr.Dataframe, str]:
    if not latex_text:
        raise gr.Error("No working document loaded to snapshot.")
    entry = {
        "name": f"Version {len(history) + 1}",
        "timestamp": _timestamp(),
        "text": latex_text,
    }
    updated = history + [entry]
    table = gr.update(
        value=format_version_history(updated),
        headers=["Working Versions", "Timestamp"],
    )
    return updated, table, f"Snapshot saved as {entry['name']}."


def promote_working_to_original(
    latex_text: str,
    original_history: List[Dict[str, str]],
    section_choice: str,
    sections: List[Dict[str, str]],
) -> Tuple[str, str, List[Dict[str, str]], gr.Dataframe, str, List[Dict[str, str]], str]:
    if not latex_text:
        raise gr.Error("No working document available to promote.")
    entry = {
        "name": f"Original v{len(original_history) + 1}",
        "timestamp": _timestamp(),
        "text": latex_text,
    }
    updated_history = original_history + [entry]
    table = gr.update(
        value=format_version_history(updated_history),
        headers=["Original Versions", "Timestamp"],
    )
    new_original_sections = parse_sections(latex_text)
    html_preview = render_document_html(new_original_sections)
    diff_html = section_diff_html(section_choice, sections, new_original_sections)
    return (
        html_preview,
        latex_text,
        updated_history,
        table,
        diff_html,
        new_original_sections,
        "Working document promoted to new original baseline.",
    )


def llm_rewrite_section(
    section_choice: str,
    sections: List[Dict[str, str]],
    instruction: str,
    model_name: str,
) -> Tuple[str, str]:
    if not section_choice:
        raise gr.Error("Select a section before requesting an LLM rewrite.")
    section = _find_section(section_choice, sections)
    if not section:
        raise gr.Error("Selected section is unavailable; reinitialize and try again.")
    if not model_name:
        raise gr.Error("Select an LLM provider first.")
    model = llm_registry.get_chat_model(model_name)
    directive = instruction.strip() or "Improve clarity while preserving meaning."
    prompt = (
        "You are editing a LaTeX research document. Rewrite the section body below "
        "according to the user request. Return only valid LaTeX that replaces the current body, "
        "without adding \\section or \\subsection headers.\n\n"
        f"User request: {directive}\n\n"
        "Current section body:\n"
        "--------------------\n"
        f"{section['body'].strip()}\n"
        "--------------------\n"
    )
    response = model.invoke(
        [
            {"role": "system", "content": "You are a meticulous LaTeX editor."},
            {"role": "user", "content": prompt},
        ]
    )
    new_text = getattr(response, "content", str(response)).strip()
    if not new_text:
        raise gr.Error("The LLM did not return any content.")
    return new_text, f"LLM rewrite completed for {section_choice}."


def regenerate_document(
    topic: str,
    model_name: str,
    compare_path: str,
    system_prompt: str,
) -> Tuple[
    str,
    Optional[ResearchChatSession],
    str,
    str,
    gr.Dropdown,
    List[Dict[str, str]],
    str,
    str,
    gr.Dropdown,
    List[Dict[str, str]],
    gr.Dataframe,
    gr.Chatbot,
    str,
    str,
    str,
    List[Dict[str, str]],
    gr.Dataframe,
    List[Dict[str, str]],
    gr.Dataframe,
    List[Dict[str, str]],
]:
    topic = topic.strip()
    if not topic:
        raise gr.Error("Enter a topic before re-running the research pipeline.")
    pipeline = ResearchPipeline(llm_name=model_name or None, debug=False)
    result = pipeline.run(
        topic=topic,
        llm_name=model_name or None,
        workdir="results",
        compile_pdf=False,
    )
    new_context_path = result.tex_path
    init_outputs = list(
        init_session(
            new_context_path,
            compare_path,
            model_name,
            system_prompt,
        )
    )
    # init_session returns [session, status, ...]; update status with regen info
    init_outputs[1] = (
        f"Re-ran research for '{topic}' using {result.model_name}.\n"
        + init_outputs[1]
    )
    return (new_context_path, *init_outputs)


def respond(
    message: str,
    chat_history: List[Tuple[str, str]],
    session: Optional[ResearchChatSession],
) -> Tuple[str, List[Tuple[str, str]], Optional[ResearchChatSession]]:
    if not session:
        raise gr.Error("Initialize the chat session first.")
    try:
        reply = session.send(message)
    except Exception as exc:  # pragma: no cover - runtime error
        raise gr.Error(f"Model invocation failed: {exc}") from exc
    chat_history = chat_history + [(message, reply)]
    return "", chat_history, session


def build_demo() -> gr.Blocks:
    model_choices = llm_registry.list_available() or ["ollama:llama3"]
    default_model = model_choices[0]
    with gr.Blocks(title="DeepAgents Research Chat") as demo:
        gr.Markdown(
            "## DeepAgents Research Chat\n"
            "1. Enter a topic or specify a context file path.\n"
            "2. Click \"Resolve Topic\" to locate the LaTeX output.\n"
            "3. Initialize the session, browse the rendered document, add comments, and chat."
        )

        status_box = gr.Textbox(label="Status", value="Idle.", interactive=False)

        with gr.Row():
            topic_input = gr.Textbox(
                label="Topic",
                value=DEFAULT_TOPIC,
                placeholder="Agentic Security",
            )
            with gr.Column():
                resolve_button = gr.Button("Resolve Topic")
                generate_button = gr.Button("Generate Topic")

        with gr.Row():
            context_path = gr.Textbox(
                value=DEFAULT_CONTEXT,
                label="Primary context file",
                placeholder="results/topic/topic.tex",
            )
            compare_path = gr.Textbox(
                value="",
                label="Comparison file (optional)",
                placeholder="results/topic/topic_draft.tex",
            )
        model_dropdown = gr.Dropdown(
            choices=model_choices,
            value=default_model,
            label="LLM Provider",
        )

        system_prompt = gr.Textbox(
            value=ResearchChatSession.system_prompt,
            label="System Prompt",
            lines=3,
        )
        init_button = gr.Button("Initialize Session")

        session_state = gr.State()
        sections_state = gr.State([])
        latex_state = gr.State("")
        original_latex_state = gr.State("")
        comments_state = gr.State([])
        working_versions_state = gr.State([])
        original_versions_state = gr.State([])
        original_sections_state = gr.State([])

        with gr.Row():
            original_preview = gr.HTML(label="Original Document Preview")
            diff_view = gr.HTML(label="HTML Diff (Original vs Working)")
        document_preview = gr.HTML(label="Working Document Preview")
        refresh_diff_button = gr.Button("Refresh Diff", variant="secondary")

        with gr.Row():
            working_versions_table = gr.Dataframe(
                headers=["Working Versions", "Timestamp"],
                value=[],
                wrap=True,
            )
            original_versions_table = gr.Dataframe(
                headers=["Original Versions", "Timestamp"],
                value=[],
                wrap=True,
            )
        snapshot_button = gr.Button("Snapshot Working Version")
        promote_button = gr.Button("Promote Working to Original")

        with gr.Row():
            section_dropdown = gr.Dropdown(
                label="Section",
                choices=[],
                interactive=True,
            )
            paragraph_dropdown = gr.Dropdown(
                label="Paragraph",
                choices=[],
                interactive=True,
            )
        section_html = gr.HTML(label="Section Content")
        section_editor = gr.Textbox(label="Section Editor (raw LaTeX body)", lines=12)
        save_section_button = gr.Button("Save Section Changes", variant="primary")

        llm_instruction = gr.Textbox(
            label="LLM Edit Instruction",
            lines=4,
            placeholder="Describe how the selected section should change...",
        )
        llm_edit_button = gr.Button("LLM Rewrite Section", variant="secondary")
        llm_edit_status = gr.Textbox(label="LLM Edit Status", interactive=False)

        comment_box = gr.Textbox(label="Add Comment", lines=4)
        add_comment_button = gr.Button("Submit Comment")
        comments_table = gr.Dataframe(
            headers=["Section", "Paragraph", "Comment"],
            value=[],
            wrap=True,
        )

        chat_history = gr.Chatbot(label="Chat", height=350)
        msg = gr.Textbox(
            label="Your Message",
            placeholder="Ask anything about the loaded document…",
        )
        send_button = gr.Button("Send")
        rerun_button = gr.Button("Re-run Planning & Research", variant="secondary")

        resolve_button.click(
            fn=resolve_topic_path,
            inputs=[topic_input],
            outputs=[context_path, status_box],
        )
        generate_button.click(
            fn=generate_topic,
            inputs=[topic_input, model_dropdown],
            outputs=[context_path, status_box],
        )

        init_button.click(
            fn=init_session,
            inputs=[context_path, compare_path, model_dropdown, system_prompt],
            outputs=[
                session_state,
                status_box,
                document_preview,
                section_dropdown,
                sections_state,
                latex_state,
                section_html,
                section_editor,
                paragraph_dropdown,
                comments_state,
                comments_table,
                chat_history,
                diff_view,
                original_preview,
                original_latex_state,
                working_versions_state,
                working_versions_table,
                original_versions_state,
                original_versions_table,
                original_sections_state,
            ],
        )

        section_dropdown.change(
            fn=select_section,
            inputs=[section_dropdown, sections_state, original_sections_state],
            outputs=[section_html, paragraph_dropdown, section_editor, diff_view],
        )

        add_comment_button.click(
            fn=add_comment,
            inputs=[
                section_dropdown,
                paragraph_dropdown,
                comment_box,
                comments_state,
                sections_state,
            ],
            outputs=[comment_box, comments_table, comments_state],
        )

        save_section_button.click(
            fn=save_section_edit,
            inputs=[
                section_dropdown,
                section_editor,
                sections_state,
                latex_state,
                context_path,
                original_latex_state,
                working_versions_state,
                original_sections_state,
            ],
            outputs=[
                status_box,
                document_preview,
                section_dropdown,
                sections_state,
                latex_state,
                section_html,
                paragraph_dropdown,
                diff_view,
                section_editor,
                working_versions_state,
                working_versions_table,
            ],
        )

        refresh_diff_button.click(
            fn=refresh_diff_state,
            inputs=[section_dropdown, sections_state, original_sections_state],
            outputs=[diff_view],
        )

        snapshot_button.click(
            fn=snapshot_working_version,
            inputs=[latex_state, working_versions_state],
            outputs=[working_versions_state, working_versions_table, status_box],
        )

        promote_button.click(
            fn=promote_working_to_original,
            inputs=[latex_state, original_versions_state, section_dropdown, sections_state],
            outputs=[original_preview, original_latex_state, original_versions_state, original_versions_table, diff_view, original_sections_state, status_box],
        )

        llm_edit_button.click(
            fn=llm_rewrite_section,
            inputs=[section_dropdown, sections_state, llm_instruction, model_dropdown],
            outputs=[section_editor, llm_edit_status],
        )

        send_button.click(
            fn=respond,
            inputs=[msg, chat_history, session_state],
            outputs=[msg, chat_history, session_state],
        )
        rerun_button.click(
            fn=regenerate_document,
            inputs=[topic_input, model_dropdown, compare_path, system_prompt],
            outputs=[
                context_path,
                session_state,
                status_box,
                document_preview,
                section_dropdown,
                sections_state,
                latex_state,
                section_html,
                section_editor,
                paragraph_dropdown,
                comments_state,
                comments_table,
                chat_history,
                diff_view,
                original_preview,
                original_latex_state,
                working_versions_state,
                working_versions_table,
                original_versions_state,
                original_versions_table,
                original_sections_state,
            ],
        )
    return demo


if __name__ == "__main__":
    app = build_demo()
    app.launch()
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
