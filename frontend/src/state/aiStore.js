/**
 * AI state slice (Zustand).
 * Manages chat messages, suggestions, and AI mode.
 */
import { create } from "zustand";
export const useAIStore = create((set) => ({
    messages: [],
    suggestions: [],
    auditLog: [],
    mode: "creative",
    loading: false,
    addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
    clearMessages: () => set({ messages: [] }),
    addSuggestion: (suggestion) => set((state) => ({ suggestions: [...state.suggestions, suggestion] })),
    updateSuggestion: (suggestionId, data) => set((state) => ({
        suggestions: state.suggestions.map((s) => s.id === suggestionId ? { ...s, ...data } : s),
    })),
    removeSuggestion: (suggestionId) => set((state) => ({
        suggestions: state.suggestions.filter((s) => s.id !== suggestionId),
    })),
    removeSuggestionsByStage: (stage) => set((state) => ({
        suggestions: state.suggestions.filter((s) => s.stage !== stage),
    })),
    clearSuggestions: () => set({ suggestions: [] }),
    addAuditEntry: (entry) => set((state) => ({ auditLog: [...state.auditLog, entry] })),
    clearAuditLog: () => set({ auditLog: [] }),
    setMode: (mode) => set({ mode }),
    setLoading: (loading) => set({ loading }),
}));
