/**
 * Book state slice (Zustand).
 * Manages chapters, annotations, and version history.
 */
import { create } from "zustand";

export interface Chapter {
  id: number;
  title: string;
  content: string;
}

export interface Annotation {
  id: string;
  chapterId: number;
  range: [number, number];
  note: string;
}

export interface VersionEntry {
  id: string;
  timestamp: string;
  chapterId: number;
  content: string;
}

interface BookState {
  chapters: Chapter[];
  activeChapterId: number | null;
  annotations: Annotation[];
  versionHistory: VersionEntry[];
  // Actions
  setChapters: (chapters: Chapter[]) => void;
  addChapter: (chapter: Chapter) => void;
  removeChapter: (chapterId: number) => void;
  setActiveChapter: (id: number) => void;
  updateChapterContent: (chapterId: number, content: string) => void;
  updateChapterTitle: (chapterId: number, title: string) => void;
  addAnnotation: (annotation: Annotation) => void;
  removeAnnotation: (annotationId: string) => void;
  addVersionEntry: (entry: VersionEntry) => void;
}

export const useBookStore = create<BookState>((set) => ({
  chapters: [],
  activeChapterId: null,
  annotations: [],
  versionHistory: [],

  setChapters: (chapters) => set({ chapters }),
  addChapter: (chapter) =>
    set((state) => ({ chapters: [...state.chapters, chapter] })),
  removeChapter: (chapterId) =>
    set((state) => ({
      chapters: state.chapters.filter((ch) => ch.id !== chapterId),
      activeChapterId:
        state.activeChapterId === chapterId ? null : state.activeChapterId,
    })),
  setActiveChapter: (id) => set({ activeChapterId: id }),
  updateChapterContent: (chapterId, content) =>
    set((state) => ({
      chapters: state.chapters.map((ch) =>
        ch.id === chapterId ? { ...ch, content } : ch
      ),
    })),
  updateChapterTitle: (chapterId, title) =>
    set((state) => ({
      chapters: state.chapters.map((ch) =>
        ch.id === chapterId ? { ...ch, title } : ch
      ),
    })),
  addAnnotation: (annotation) =>
    set((state) => ({ annotations: [...state.annotations, annotation] })),
  removeAnnotation: (annotationId) =>
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== annotationId),
    })),
  addVersionEntry: (entry) =>
    set((state) => ({ versionHistory: [...state.versionHistory, entry] })),
}));
