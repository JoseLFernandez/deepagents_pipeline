# DeepAgents Pipeline (No-src Layout)

This project is organized with all code directly in the project root:

```
/Users/jose/Documents/Artificial_Intelligence/agents/src/deepagents_pipeline
├── __init__.py
├── cli.py
├── config.py
├── eval.py
├── llm.py
├── pipeline.py
├── tools.py
├── ui.py
├── pyproject.toml
└── .venv/
```

## Running the CLI

Activate your virtual environment if not already active:

```zsh
source .venv/bin/activate
```

Run the CLI directly as a script:

```zsh
.venv/bin/python3.12 cli.py --topic "Langchain deepagents" --llm ollama:gpt-oss
```

Or as a module (if you want):

```zsh
.venv/bin/python3.12 -m cli --topic "Langchain deepagents" --llm ollama:gpt-oss
```

## Imports

All imports are now absolute (e.g., `from pipeline import ResearchPipeline`).

## Project Metadata

- Project metadata is in `pyproject.toml`.
- No `src/` subfolder is used.

## Notes
- If you add new files, use absolute imports.
- If you want to distribute as a package, update `pyproject.toml` accordingly.

## MediaGenerationAgent (Charts, Diagrams, Images, GIFs)

The repository now includes a `MediaGenerationAgent` that can generate illustrative assets for your research topics. Provide a JSON specification that describes the assets you need and run the helper CLI:

```json
{
  "topic": "Agentic Security",
  "assets": [
    {
      "kind": "chart",
      "filename": "prompt_injection_trend.png",
      "title": "Prompt Injection Incidents",
      "chart_kind": "line",
      "x_labels": ["Q1", "Q2", "Q3"],
      "series": [
        {"label": "Incidents", "values": [4, 7, 12]}
      ]
    },
    {
      "kind": "diagram",
      "filename": "agent_layers.png",
      "title": "Agent Autonomy Layers",
      "diagram_direction": "LR",
      "nodes": ["Planner", "Controller", "Actuator"],
      "edges": [["Planner", "Controller"], ["Controller", "Actuator"]]
    },
    {
      "kind": "image",
      "filename": "summary_card.png",
      "text": "Agentic Security Highlights"
    },
    {
      "kind": "video",
      "filename": "control_loop.gif",
      "text": "Threat Kill Chain"
    }
  ]
}
```

Generate all assets with:

```zsh
python3 media_cli.py --spec my_assets.json --output-root results
```

The agent writes everything to `results/<topic-slug>/media/`. Use `--dry-run` to validate the spec before generating files. Charts require `matplotlib`; image and GIF rendering rely on Pillow and imageio. All Python dependencies are listed in `requirements.txt`.
Diagrams are emitted as Mermaid definitions (`graph TD`, etc.). If your `filename`
ends with `.png` or `.svg`, the agent calls the Mermaid CLI (`mmdc`) to render the
image; otherwise, it writes the plain `.mmd` text. Install `@mermaid-js/mermaid-cli`
globally (`npm install -g @mermaid-js/mermaid-cli`) so that `mmdc` is available on
your PATH. Set `diagram_direction` to control the flow (`TD`, `LR`, `RL`, `BT`);
it defaults to `TD`.

## Gradio Research Chat UI

You can explore any generated handout through a lightweight Gradio app (`gradio_app.py`) that wraps `ResearchChatSession`.

```zsh
python3 gradio_app.py
```

Then open the provided local URL and follow the workflow:

1. **Phase 0 – Initial**: land on the dashboard and decide whether to reuse or create a topic.
2. **Phase 1.1 – Select Topic**: click **Resolve Topic** to point to `results/<topic>/<topic>.tex`.
3. **Phase 1.2 – Generate Topic**: or click **Generate Topic** to run the DeepAgents pipeline if the topic does not exist.
4. **Phase 2 – Display Result**: hit **Initialize Session**. The interface shows Original Preview, Working Preview, version tables, and a per-section diff area.
5. **Phase 3.1 – Chat**: use the chat panel to ask follow-up questions powered by your chosen LLM; gather extra context or sanity checks.
6. **Phase 3.2 – Propose Edits**:
   - Select a section; the Section Diff block renders an HTML side-by-side comparison (original vs. working) for that section only.
   - Edit the LaTeX body directly (or use **LLM Rewrite Section**). Click **Save Section Changes** to refresh the working preview and diff.
   - If satisfied, **Approve** by promoting the working version to become the new baseline. If not, you can snapshot/revert as needed.
7. **Phase 4 – Finalize**: once the chat and diff review agree on the final copy, click **Re-run Planning & Research** to regenerate the entire handout with the updated content.

## REST API for a React Frontend

If you prefer building a dedicated React UI, start the FastAPI backend defined in `react_app.py`. It exposes endpoints for topic resolution/generation, session initialization, section edits/diffs, LLM rewrites, promotions, and full regenerations.

```zsh
uvicorn react_app:app --reload
```

Before launching, set `DATABASE_URL` to your PostgreSQL instance (for example `postgresql+psycopg://user:pass@localhost/deepagents`). If `DATABASE_URL` is omitted, the server falls back to a local SQLite file (`deepagents.db`), but PostgreSQL plus a vector index (FAISS/pgvector) is recommended for RAG workflows. Running `uvicorn` will auto-create the required tables via SQLModel.

The API returns JSON payloads with HTML snippets (rendered document and section-only diffs), so the React client can reproduce the same phase flow described above. Every section edit is persisted as HTML in the database, and LaTeX is generated only when you trigger the export/regeneration endpoints.

---

For further help, just ask!
