globally (`npm install -g @mermaid-js/mermaid-cli`) so that `mmdc` is available on
your PATH. Set `diagram_direction` to control the flow (`TD`, `LR`, `RL`, `BT`);
it defaults to `TD`.

# Book Generation Frontend

## 📖 Overview
A dual-pane collaborative writing interface:  
- **Left Pane** → Existing manuscript (scrollable, editable, with chapter navigation).  
- **Right Pane** → AI-assisted drafting, brainstorming, critique, and rewriting.  
- **Bottom Bar** → Export, collaboration toggle, and AI mode switch.  

This system integrates **multi-agent orchestration** and external tools to ensure high-quality, auditable content creation.

---

## 🔑 Key Requirements
- Split-view layout for book + AI collaboration.  
- Rich text editing with annotations and version history.  
- Real-time collaboration for multiple contributors.  
- Extensible UI for AI suggestions, media, and references.  

---

## ⚙️ Frontend Frameworks & Libraries
- **React + Material UI (MUI)** → polished UI and split-pane layouts.  
- **Chakra UI** → lightweight, customizable styling.  
- **Tiptap (ProseMirror)** → robust rich text editor with collaboration support.  
- **Quill.js / Slate.js** → alternatives for lightweight editing.  

---

## 📐 Suggested Layout
```
<App>
 ├── <TopBar>
 ├── <MainLayout>
 │     ├── <BookPane>   // Chapters + Editor
 │     ├── <AIPane>     // Chat + Suggestions
 └── <BottomBar>
```

- **BookPane** → Chapter navigation, rich text editor, annotations.  
- **AIPane** → Chat-like interface, suggestion cards, rewrite/expand/summarize options.  
- **BottomBar** → Export (PDF/DOCX/EPUB), collaboration toggle, AI mode switch.  

---

## 🗂️ State Management
- **Redux or Zustand** for global state.  
- Store slices:  
  - `book` → chapters, annotations, version history.  
  - `ai` → messages, suggestions, mode.  
  - `ui` → layout, theme, loading state.  
- Actions: `EDIT_BOOK_CONTENT`, `SEND_AI_PROMPT`, `INSERT_SUGGESTION`, `EXPORT_BOOK`.  

---

## ⚙️ Middleware Layer
- **DeepAgents** orchestrates workflows.  
- Responsibilities:  
  - Action interception.  
  - AI request handling.  
  - Auditable logging (prompts, responses, timestamps).  
  - Error management + retries.  
  - Caching suggestions.  
  - Collaboration hooks for multi-user editing.  

---

## 🔧 Multi-Tool Orchestration
- **DeepAgents** → workflow orchestration and traceability.  
- **Search tools (Copilot search_web, Perplexity, Arxiv)** → contextual grounding and references.  
- **Picsart API** → image/video generation for illustrations, cover art, or multimedia content.  

---

## 🧠 Quality Improvement Agents
- **Generation Agent** → produces initial draft.  
- **Reflection Agent** → self-review, identifies gaps.  
- **Critique Agent** → peer review, flags issues.  
- **Editor Agent** → applies improvements, ensures consistency.  

---

## 🔄 Example Workflow
1. User edits text in **BookPane**.  
2. User requests AI rewrite in **AIPane**.  
3. **Generation Agent** produces draft.  
4. **Reflection + Critique Agents** evaluate draft.  
5. **Editor Agent** produces polished version.  
6. User inserts final draft into **BookPane**.  
7. Optional: Picsart API generates images/videos for enrichment.  

---

## ✅ Benefits
- **Transparency** → every agent’s contribution logged.  
- **Quality** → multi-pass refinement ensures polished output.  
- **Control** → user can accept/reject at each stage.  
- **Auditability** → version history and agent traces preserved.  

---
