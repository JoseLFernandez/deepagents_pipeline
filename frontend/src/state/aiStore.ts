/**
 * AI state slice (Zustand).
 * Manages chat messages, suggestions, and AI mode.
 */
import { create } from "zustand";

export type AIMode = "creative" | "factual" | "summarize";

export type AIAgentStage = "generation" | "reflection" | "critique" | "editor";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  text: string;
  timestamp: string;
  toolName?: string;
  stage?: AIAgentStage;
  status?: "started" | "success" | "error" | "cached";
  metadata?: Record<string, unknown>;
}

export interface AISuggestion {
  id: string;
  type:
    | "rewrite"
    | "expand"
    | "summarize"
    | "other"
    | "image"
    | AIAgentStage;
  text: string;
  chapterId?: number;
  createdAt: string;
  stage?: AIAgentStage;
  stageOrder?: number;
  sourcePrompt?: string;
  notes?: string;
  cached?: boolean;
}

export interface AIAuditEntry {
  id: string;
  stage: AIAgentStage | "request" | "image" | "error";
  timestamp: string;
  message: string;
  details?: Record<string, unknown>;
  status: "started" | "success" | "error" | "cached";
}

interface AIState {
  messages: ChatMessage[];
  suggestions: AISuggestion[];
  auditLog: AIAuditEntry[];
  mode: AIMode;
  loading: boolean;
  // Actions
  addMessage: (msg: ChatMessage) => void;
  clearMessages: () => void;
  addSuggestion: (suggestion: AISuggestion) => void;
  updateSuggestion: (suggestionId: string, data: Partial<AISuggestion>) => void;
  removeSuggestion: (suggestionId: string) => void;
  removeSuggestionsByStage: (stage: AIAgentStage) => void;
  clearSuggestions: () => void;
  addAuditEntry: (entry: AIAuditEntry) => void;
  clearAuditLog: () => void;
  setMode: (mode: AIMode) => void;
  setLoading: (loading: boolean) => void;
}

export const useAIStore = create<AIState>((set) => ({
  messages: [],
  suggestions: [],
  auditLog: [],
  mode: "creative",
  loading: false,

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),
  clearMessages: () => set({ messages: [] }),
  addSuggestion: (suggestion) =>
    set((state) => ({ suggestions: [...state.suggestions, suggestion] })),
  updateSuggestion: (suggestionId, data) =>
    set((state) => ({
      suggestions: state.suggestions.map((s) =>
        s.id === suggestionId ? { ...s, ...data } : s
      ),
    })),
  removeSuggestion: (suggestionId) =>
    set((state) => ({
      suggestions: state.suggestions.filter((s) => s.id !== suggestionId),
    })),
  removeSuggestionsByStage: (stage) =>
    set((state) => ({
      suggestions: state.suggestions.filter((s) => s.stage !== stage),
    })),
  clearSuggestions: () => set({ suggestions: [] }),
  addAuditEntry: (entry) =>
    set((state) => ({ auditLog: [...state.auditLog, entry] })),
  clearAuditLog: () => set({ auditLog: [] }),
  setMode: (mode) => set({ mode }),
  setLoading: (loading) => set({ loading }),
}));
