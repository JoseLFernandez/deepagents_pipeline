/**
 * UI state slice (Zustand).
 * Manages layout, theme, and loading state.
 */
import { create } from "zustand";
export const useUIStore = create((set) => ({
    layout: "split",
    theme: "light",
    globalLoading: false,
    statusMessage: "Ready.",
    setLayout: (layout) => set({ layout }),
    setTheme: (theme) => set({ theme }),
    setGlobalLoading: (globalLoading) => set({ globalLoading }),
    setStatusMessage: (statusMessage) => set({ statusMessage }),
}));
