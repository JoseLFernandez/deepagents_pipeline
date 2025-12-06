/**
 * Book Middleware: Handles book persistence, export, and version history.
 * Uses localStorage for now; backend endpoints (/book/save, /book/load, /book/export) can be added later.
 */

import { useBookStore, Chapter, Annotation, VersionEntry } from "../state";

const API_BASE = "http://localhost:8000";
const LOCAL_STORAGE_KEY = "deepagents_book_data";

// Types for backend requests/responses
interface SaveBookRequest {
  chapters: Chapter[];
  annotations: Annotation[];
}

interface SaveBookResponse {
  message: string;
}

interface LoadBookResponse {
  chapters: Chapter[];
  annotations: Annotation[];
  versionHistory: VersionEntry[];
}

interface ExportBookRequest {
  format: "pdf" | "docx" | "epub";
  chapters: Chapter[];
}

interface ExportBookResponse {
  url: string;
  message: string;
}

// Logging helper
function logBookAction(action: string, payload: unknown) {
  const timestamp = new Date().toISOString();
  console.log(`[Book Middleware] ${timestamp} | ${action}`, payload);
}

// Error handler
function handleError(error: unknown, context: string): string {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[Book Middleware Error] ${context}:`, msg);
  return msg;
}

// ========== Local Storage Fallback ==========

function saveToLocalStorage(chapters: Chapter[], annotations: Annotation[]): void {
  const data = { chapters, annotations, savedAt: new Date().toISOString() };
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
}

function loadFromLocalStorage(): { chapters: Chapter[]; annotations: Annotation[] } | null {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ========== API Calls (with localStorage fallback) ==========

export async function saveBook(
  chapters: Chapter[],
  annotations: Annotation[]
): Promise<string> {
  logBookAction("saveBook", { chapters, annotations });
  
  // Try backend first
  try {
    const payload: SaveBookRequest = { chapters, annotations };
    const response = await fetch(`${API_BASE}/book/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const res = (await response.json()) as SaveBookResponse;
      logBookAction("saveBookResponse", res);
      return res.message;
    }
  } catch (err) {
    logBookAction("saveBookBackendFailed", { error: err });
  }
  
  // Fallback to localStorage
  saveToLocalStorage(chapters, annotations);
  logBookAction("saveBookLocalStorage", { chapters: chapters.length });
  return "Book saved locally.";
}

export async function loadBook(): Promise<LoadBookResponse> {
  logBookAction("loadBook", {});
  
  // Try backend first
  try {
    const response = await fetch(`${API_BASE}/book/load`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (response.ok) {
      const res = (await response.json()) as LoadBookResponse;
      logBookAction("loadBookResponse", res);
      return res;
    }
  } catch (err) {
    logBookAction("loadBookBackendFailed", { error: err });
  }
  
  // Fallback to localStorage
  const local = loadFromLocalStorage();
  if (local) {
    logBookAction("loadBookLocalStorage", { chapters: local.chapters.length });
    return { ...local, versionHistory: [] };
  }
  
  return { chapters: [], annotations: [], versionHistory: [] };
}

export async function exportBook(
  format: "pdf" | "docx" | "epub",
  chapters: Chapter[]
): Promise<string> {
  logBookAction("exportBook", { format, chapters });
  
  // Try backend first
  try {
    const payload: ExportBookRequest = { format, chapters };
    const response = await fetch(`${API_BASE}/book/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const res = (await response.json()) as ExportBookResponse;
      logBookAction("exportBookResponse", res);
      return res.url;
    }
  } catch (err) {
    logBookAction("exportBookBackendFailed", { error: err });
  }
  
  // Fallback: generate a downloadable blob URL
  const content = chapters.map((ch) => `# ${ch.title}\n\n${ch.content}`).join("\n\n---\n\n");
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  logBookAction("exportBookLocalBlob", { format, url });
  return url;
}

// ========== Zustand integration helpers ==========

/**
 * High-level: Save the current book to backend.
 */
export async function handleSaveBook(): Promise<string> {
  const { chapters, annotations, addVersionEntry } = useBookStore.getState();
  try {
    const msg = await saveBook(chapters, annotations);
    // Add version entry
    const entry: VersionEntry = {
      id: `v-${Date.now()}`,
      timestamp: new Date().toISOString(),
      chapterId: 0, // 0 = whole book
      content: JSON.stringify(chapters),
    };
    addVersionEntry(entry);
    return msg;
  } catch (err) {
    return handleError(err, "handleSaveBook");
  }
}

/**
 * High-level: Load a book from backend and update store.
 */
export async function handleLoadBook(): Promise<void> {
  const { setChapters, setActiveChapter } = useBookStore.getState();
  try {
    const data = await loadBook();
    setChapters(data.chapters);
    if (data.chapters.length > 0) {
      setActiveChapter(data.chapters[0].id);
    }
  } catch (err) {
    handleError(err, "handleLoadBook");
  }
}

/**
 * High-level: Export the book to a file.
 */
export async function handleExportBook(
  format: "pdf" | "docx" | "epub"
): Promise<string> {
  const { chapters } = useBookStore.getState();
  try {
    const url = await exportBook(format, chapters);
    // Trigger download
    window.open(url, "_blank");
    return url;
  } catch (err) {
    return handleError(err, "handleExportBook");
  }
}
