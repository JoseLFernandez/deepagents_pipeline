/**
 * State store barrel export.
 */
export { useBookStore } from "./bookStore";
export type { Chapter, Annotation, VersionEntry } from "./bookStore";

export { useAIStore } from "./aiStore";
export type { AIMode, ChatMessage, AISuggestion, AIAgentStage, AIAuditEntry } from "./aiStore";

export { useUIStore } from "./uiStore";
export type { LayoutMode, ThemeMode } from "./uiStore";

export { useCollaborationStore } from "./collaborationStore";
