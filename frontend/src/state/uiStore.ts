/**
 * UI state slice (Zustand).
 * Manages layout, theme, and loading state.
 */
import { create } from "zustand";

export type LayoutMode = "split" | "book-only" | "ai-only";
export type ThemeMode = "light" | "dark";

interface UIState {
  layout: LayoutMode;
  theme: ThemeMode;
  globalLoading: boolean;
  statusMessage: string;
  // Actions
  setLayout: (layout: LayoutMode) => void;
  setTheme: (theme: ThemeMode) => void;
  setGlobalLoading: (loading: boolean) => void;
  setStatusMessage: (msg: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  layout: "split",
  theme: "light",
  globalLoading: false,
  statusMessage: "Ready.",

  setLayout: (layout) => set({ layout }),
  setTheme: (theme) => set({ theme }),
  setGlobalLoading: (globalLoading) => set({ globalLoading }),
  setStatusMessage: (statusMessage) => set({ statusMessage }),
}));
