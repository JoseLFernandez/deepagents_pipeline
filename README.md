# DeepAgents Pipeline

A hybrid research-and-writing stack that combines a scripted DeepAgents pipeline
with a modern book-generation frontend. The backend chains multiple LLM-powered
agents to research a topic, distill the findings into LaTeX, and optionally
compile PDFs. The frontend provides a collaborative editor where humans and AI
co-author chapters, critique drafts, and export manuscripts.

---

## Repository Layout

- `cli.py` / `pipeline.py` - entry point for running the research workflow.
- `tools.py`, `llm.py`, `media_agent.py` - supporting agents/tooling registered in
  the pipeline.
- `frontend/` - React (Vite) application for the dual-pane writing experience.
- `react_app.py` - helper for launching the React build inside a Python host.
- `results/` - default output directory for generated research packets.

---

## Prerequisites

| Component | Requirement |
| --- | --- |
| Backend | Python 3.10+, `pip` |
| Frontend | Node.js 18+, npm |
| Optional | `mmdc` (`npm install -g @mermaid-js/mermaid-cli`) to render Mermaid diagrams referenced by the pipeline |

---

## Backend Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# or: pip install -e . for the package in pyproject.toml
```

Configuration defaults live in `config.py`. Update your preferred LLM ids, API
keys, and feature toggles there, or override them through environment variables.

---

## Running the Research Pipeline

```bash
PYTHONPATH=src python cli.py \
  --topic "Future of open multi-agent systems" \
  --llm ollama:gpt-oss \
  --workdir results/my_topic \
  --json
```

Flags:

- `--topic` (required) - subject for the research packet.
- `--llm` - registry key defined in `llm.py` (falls back to config default).
- `--workdir` - folder where LaTeX, PDFs, and traces are stored.
- `--no-pdf` - skip `pdflatex` if you only need LaTeX output.
- `--json` - emit a JSON summary for downstream automation.
- `--debug` - print an agent-by-agent execution trace.

The pipeline orchestrates generation, reflection, critique, and editorial agents;
tool calls (search, media generation, etc.) are mediated through `tools.py`.

---

## Book Generation Frontend

The React frontend mirrors how authors collaborate with the autonomous agents.

### Install & Run

```bash
cd frontend
npm install
npm run dev
# visit http://localhost:5173
```

Key components (all under `frontend/src/components`):

- `BookPane` - manuscript chapters, annotations, and history.
- `AIPane` - conversational AI suggestions, rewrites, critiques.
- `OutlinePanel` - chapter list with quick actions.
- `MainLayout` / `TopBar` / `BottomBar` - global UI chrome.

State is handled via Zustand stores defined in `frontend/src/state`, with
middleware in `frontend/src/middleware` dispatching AI requests through the
DeepAgents backend.

---

## Suggested Workflow

1. Run the CLI to gather research, references, and LaTeX exports.
2. Load/export that content through the frontend's `BookApp`.
3. Iterate on drafts: BookPane for editing, AIPane for AI revisions, OutlinePanel
   for structure, and VersionHistory for auditability.
4. Use the bottom bar to export (PDF/DOCX/EPUB), toggle collaboration, or switch
   AI personas.

---

## Contributing

1. Branch from `main`.
2. Keep frontend and backend changes in separate commits when possible.
3. Add/update tests or manual verification notes in PR descriptions.
4. Run `npm run lint`/`npm run test` (frontend) and relevant Python tests before
   pushing.

---

## Support

For Dependabot alerts or security issues, review the alerts tab on GitHub. For
general questions, open an issue or contact the maintainers listed in
`pyproject.toml`.
