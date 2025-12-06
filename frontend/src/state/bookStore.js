/**
 * Book state slice (Zustand).
 * Manages chapters, annotations, and version history.
 */
import { create } from "zustand";
export const useBookStore = create((set) => ({
    chapters: [],
    activeChapterId: null,
    annotations: [],
    versionHistory: [],
    setChapters: (chapters) => set({ chapters }),
    addChapter: (chapter) => set((state) => ({ chapters: [...state.chapters, chapter] })),
    removeChapter: (chapterId) => set((state) => ({
        chapters: state.chapters.filter((ch) => ch.id !== chapterId),
        activeChapterId: state.activeChapterId === chapterId ? null : state.activeChapterId,
    })),
    setActiveChapter: (id) => set({ activeChapterId: id }),
    updateChapterContent: (chapterId, content) => set((state) => ({
        chapters: state.chapters.map((ch) => ch.id === chapterId ? { ...ch, content } : ch),
    })),
    updateChapterTitle: (chapterId, title) => set((state) => ({
        chapters: state.chapters.map((ch) => ch.id === chapterId ? { ...ch, title } : ch),
    })),
    addAnnotation: (annotation) => set((state) => ({ annotations: [...state.annotations, annotation] })),
    removeAnnotation: (annotationId) => set((state) => ({
        annotations: state.annotations.filter((a) => a.id !== annotationId),
    })),
    addVersionEntry: (entry) => set((state) => ({ versionHistory: [...state.versionHistory, entry] })),
}));
