/**
 * collaborationStore: Zustand store for real-time collaboration state.
 */
import { create } from "zustand";
const PANEL_VISIBILITY_KEY = "deepagents_panel_visibility";
const SAVED_PANEL_VISIBILITY_KEY = "deepagents_panel_visibility_saved";
const FOCUS_MODE_KEY = "deepagents_focus_mode";
const LAST_PRIMARY_PANEL_KEY = "deepagents_last_primary_panel";
const DEFAULT_PANEL_VISIBILITY = {
    collaboration: false,
    versionHistory: false,
    aiPane: true,
    chapterNav: true,
};
// Generate a random color for collaborators
const generateColor = () => {
    const colors = [
        "#F44336", "#E91E63", "#9C27B0", "#673AB7",
        "#3F51B5", "#2196F3", "#03A9F4", "#00BCD4",
        "#009688", "#4CAF50", "#8BC34A", "#CDDC39",
        "#FFC107", "#FF9800", "#FF5722",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
};
// Generate a random user ID
const generateUserId = () => `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
// Load saved panel visibility from localStorage
const loadPanelVisibility = () => {
    if (typeof window !== "undefined") {
        const saved = localStorage.getItem(PANEL_VISIBILITY_KEY);
        if (saved) {
            try {
                return JSON.parse(saved);
            }
            catch {
                // ignore parsing error
            }
        }
        const focusActive = localStorage.getItem(FOCUS_MODE_KEY) === "true";
        if (focusActive) {
            const lastPrimary = loadLastPrimaryPanel();
            return {
                collaboration: false,
                versionHistory: false,
                aiPane: lastPrimary === "aiPane",
                chapterNav: lastPrimary === "chapterNav",
            };
        }
    }
    return DEFAULT_PANEL_VISIBILITY;
};
// Load focus mode state from localStorage
const loadFocusMode = () => {
    if (typeof window !== "undefined") {
        return localStorage.getItem(FOCUS_MODE_KEY) === "true";
    }
    return false;
};
const loadLastPrimaryPanel = () => {
    if (typeof window !== "undefined") {
        const stored = localStorage.getItem(LAST_PRIMARY_PANEL_KEY);
        if (stored === "aiPane" || stored === "chapterNav") {
            return stored;
        }
    }
    return "chapterNav";
};
export const useCollaborationStore = create((set, get) => ({
    // Initial state
    sessionId: null,
    currentUserId: generateUserId(),
    collaborators: [],
    messages: [],
    versions: [],
    focusModeActive: loadFocusMode(),
    panelVisibility: loadPanelVisibility(),
    lastPrimaryPanel: loadLastPrimaryPanel(),
    // Session actions
    setSessionId: (id) => set({ sessionId: id }),
    setCurrentUserId: (id) => set({ currentUserId: id }),
    // Collaborator actions
    addCollaborator: (collaborator) => set((state) => ({
        collaborators: [...state.collaborators, { ...collaborator, color: collaborator.color || generateColor() }],
    })),
    removeCollaborator: (id) => set((state) => ({
        collaborators: state.collaborators.filter((c) => c.id !== id),
    })),
    updateCollaborator: (id, updates) => set((state) => ({
        collaborators: state.collaborators.map((c) => c.id === id ? { ...c, ...updates } : c),
    })),
    setCollaborators: (collaborators) => set({ collaborators }),
    // Chat actions
    addMessage: (message) => set((state) => ({
        messages: [...state.messages, message],
    })),
    setMessages: (messages) => set({ messages }),
    // Version history actions
    addVersion: (version) => set((state) => ({
        versions: [version, ...state.versions].slice(0, 100), // Keep last 100 versions
    })),
    setVersions: (versions) => set({ versions }),
    // Focus mode actions
    setFocusModeActive: (active) => {
        if (typeof window !== "undefined") {
            localStorage.setItem(FOCUS_MODE_KEY, String(active));
        }
        if (active) {
            const { panelVisibility, lastPrimaryPanel } = get();
            if (typeof window !== "undefined") {
                localStorage.setItem(SAVED_PANEL_VISIBILITY_KEY, JSON.stringify(panelVisibility));
            }
            const focusVisibility = {
                collaboration: false,
                versionHistory: false,
                aiPane: lastPrimaryPanel === "aiPane",
                chapterNav: lastPrimaryPanel === "chapterNav",
            };
            if (typeof window !== "undefined") {
                localStorage.setItem(PANEL_VISIBILITY_KEY, JSON.stringify(focusVisibility));
            }
            set({ focusModeActive: true, panelVisibility: focusVisibility });
        }
        else {
            let restoredVisibility = DEFAULT_PANEL_VISIBILITY;
            if (typeof window !== "undefined") {
                const saved = localStorage.getItem(SAVED_PANEL_VISIBILITY_KEY);
                if (saved) {
                    try {
                        restoredVisibility = JSON.parse(saved);
                    }
                    catch {
                        restoredVisibility = DEFAULT_PANEL_VISIBILITY;
                    }
                    localStorage.removeItem(SAVED_PANEL_VISIBILITY_KEY);
                }
                localStorage.setItem(PANEL_VISIBILITY_KEY, JSON.stringify(restoredVisibility));
            }
            set({ focusModeActive: false, panelVisibility: restoredVisibility });
        }
    },
    toggleFocusMode: () => {
        const { focusModeActive, setFocusModeActive } = get();
        setFocusModeActive(!focusModeActive);
    },
    setPanelVisibility: (visibility) => set((state) => {
        const newVisibility = { ...state.panelVisibility, ...visibility };
        let nextLastPrimary = state.lastPrimaryPanel;
        if (typeof visibility.aiPane === "boolean" && visibility.aiPane) {
            nextLastPrimary = "aiPane";
        }
        if (typeof visibility.chapterNav === "boolean" && visibility.chapterNav) {
            nextLastPrimary = "chapterNav";
        }
        if (typeof window !== "undefined") {
            localStorage.setItem(PANEL_VISIBILITY_KEY, JSON.stringify(newVisibility));
            if (nextLastPrimary !== state.lastPrimaryPanel) {
                localStorage.setItem(LAST_PRIMARY_PANEL_KEY, nextLastPrimary);
            }
        }
        return { panelVisibility: newVisibility, lastPrimaryPanel: nextLastPrimary };
    }),
    togglePanel: (panel) => set((state) => {
        const newVisibility = {
            ...state.panelVisibility,
            [panel]: !state.panelVisibility[panel],
        };
        if (typeof window !== "undefined") {
            localStorage.setItem(PANEL_VISIBILITY_KEY, JSON.stringify(newVisibility));
        }
        // If any panel is shown, exit focus mode
        const anyVisible = Object.values(newVisibility).some(Boolean);
        const exitingFocus = state.focusModeActive && anyVisible;
        if (exitingFocus && typeof window !== "undefined") {
            localStorage.setItem(FOCUS_MODE_KEY, "false");
            localStorage.removeItem(SAVED_PANEL_VISIBILITY_KEY);
        }
        let nextLastPrimary = state.lastPrimaryPanel;
        const toggledValue = newVisibility[panel];
        if ((panel === "aiPane" || panel === "chapterNav") && toggledValue) {
            nextLastPrimary = panel;
        }
        else if ((panel === "aiPane" || panel === "chapterNav") &&
            !toggledValue &&
            state.lastPrimaryPanel === panel) {
            if (panel === "aiPane" && newVisibility.chapterNav) {
                nextLastPrimary = "chapterNav";
            }
            else if (panel === "chapterNav" && newVisibility.aiPane) {
                nextLastPrimary = "aiPane";
            }
        }
        if (typeof window !== "undefined" && nextLastPrimary !== state.lastPrimaryPanel) {
            localStorage.setItem(LAST_PRIMARY_PANEL_KEY, nextLastPrimary);
        }
        return {
            panelVisibility: newVisibility,
            focusModeActive: exitingFocus ? false : state.focusModeActive,
            lastPrimaryPanel: nextLastPrimary,
        };
    }),
}));
