import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * BookPane: Chapter navigation (MUI Drawer/List) + Tiptap BookEditor with rich formatting.
 */
import { useState, useEffect } from "react";
import { Box, Drawer, List, ListItemButton, ListItemText, ListItemIcon, Typography, Divider, IconButton, Tooltip, Toolbar, useTheme, } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ArticleIcon from "@mui/icons-material/Article";
import AddIcon from "@mui/icons-material/Add";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Image } from "@tiptap/extension-image";
import { Link } from "@tiptap/extension-link";
import { Underline } from "@tiptap/extension-underline";
import { TextAlign } from "@tiptap/extension-text-align";
import { Highlight } from "@tiptap/extension-highlight";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import EditorToolbar from "./EditorToolbar";
// Create lowlight instance with common languages
const lowlight = createLowlight(common);
const DRAWER_WIDTH = 240;
const BookPane = ({ chapters, activeChapterId, onSelectChapter, onContentChange, onAddChapter, forceCollapseDrawer = false, isFocusMode = false, }) => {
    const theme = useTheme();
    const [drawerOpen, setDrawerOpen] = useState(!forceCollapseDrawer);
    const activeChapter = chapters.find((ch) => ch.id === activeChapterId);
    useEffect(() => {
        if (forceCollapseDrawer) {
            setDrawerOpen(false);
        }
    }, [forceCollapseDrawer]);
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                codeBlock: false, // We use CodeBlockLowlight instead
            }),
            Placeholder.configure({ placeholder: "Start writing your chapter..." }),
            // Tables
            Table.configure({
                resizable: true,
                HTMLAttributes: {
                    class: "tiptap-table",
                },
            }),
            TableRow,
            TableHeader,
            TableCell,
            // Images
            Image.configure({
                inline: false,
                allowBase64: true,
                HTMLAttributes: {
                    class: "tiptap-image",
                },
            }),
            // Links
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: "tiptap-link",
                },
            }),
            // Text formatting
            Underline,
            TextAlign.configure({
                types: ["heading", "paragraph"],
            }),
            Highlight.configure({
                multicolor: false,
            }),
            // Task lists
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
            // Code blocks with syntax highlighting
            CodeBlockLowlight.configure({
                lowlight,
                HTMLAttributes: {
                    class: "tiptap-code-block",
                },
            }),
        ],
        content: activeChapter?.content || "",
        onUpdate: ({ editor }) => {
            if (activeChapterId != null) {
                onContentChange(activeChapterId, editor.getHTML());
            }
        },
    }, [activeChapterId]);
    return (_jsxs(Box, { sx: { display: "flex", height: "100%" }, children: [_jsxs(Drawer, { variant: "persistent", anchor: "left", open: drawerOpen, sx: {
                    width: drawerOpen ? DRAWER_WIDTH : 0,
                    flexShrink: 0,
                    "& .MuiDrawer-paper": {
                        width: DRAWER_WIDTH,
                        position: "relative",
                        boxSizing: "border-box",
                        borderRight: `1px solid ${theme.palette.divider}`,
                    },
                }, children: [_jsxs(Toolbar, { sx: {
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            px: 1,
                        }, children: [_jsx(Typography, { variant: "subtitle1", fontWeight: "bold", children: "Chapters" }), _jsxs(Box, { children: [onAddChapter && (_jsx(Tooltip, { title: "Add Chapter", children: _jsx(IconButton, { size: "small", onClick: onAddChapter, children: _jsx(AddIcon, { fontSize: "small" }) }) })), _jsx(IconButton, { onClick: () => setDrawerOpen(false), children: _jsx(ChevronLeftIcon, {}) })] })] }), _jsx(Divider, {}), _jsx(List, { sx: { overflowY: "auto", flex: 1 }, children: chapters.map((ch, index) => (_jsxs(ListItemButton, { selected: ch.id === activeChapterId, onClick: () => onSelectChapter(ch.id), sx: {
                                borderRadius: 1,
                                mx: 1,
                                mb: 0.5,
                                "&.Mui-selected": {
                                    backgroundColor: theme.palette.primary.light,
                                    color: theme.palette.primary.contrastText,
                                    "&:hover": {
                                        backgroundColor: theme.palette.primary.main,
                                    },
                                },
                            }, children: [_jsx(ListItemIcon, { sx: { minWidth: 36 }, children: _jsx(ArticleIcon, { fontSize: "small" }) }), _jsx(ListItemText, { primary: ch.title, primaryTypographyProps: {
                                        variant: "body2",
                                        noWrap: true,
                                    } })] }, ch.id))) })] }), _jsxs(Box, { sx: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }, children: [_jsxs(Box, { sx: {
                            display: "flex",
                            alignItems: "center",
                            p: 1,
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            backgroundColor: theme.palette.background.paper,
                        }, children: [!drawerOpen && (_jsx(IconButton, { onClick: () => setDrawerOpen(true), sx: { mr: 1 }, children: _jsx(MenuIcon, {}) })), _jsx(Typography, { variant: "h6", noWrap: true, sx: { flex: 1 }, children: activeChapter?.title || "Select a chapter" })] }), _jsx(EditorToolbar, { editor: editor }), _jsx(Box, { sx: {
                            flex: 1,
                            overflowY: "auto",
                            p: isFocusMode ? 0 : 3,
                            backgroundColor: theme.palette.mode === "dark" ? "#1e1e1e" : "#fafafa",
                        }, children: _jsx(Box, { sx: {
                                maxWidth: isFocusMode ? "100%" : 800,
                                mx: isFocusMode ? 0 : "auto",
                                width: "100%",
                                backgroundColor: theme.palette.background.paper,
                                borderRadius: isFocusMode ? 0 : 2,
                                boxShadow: isFocusMode ? 0 : 1,
                                minHeight: "100%",
                                p: isFocusMode ? 4 : 3,
                                // Tiptap editor styles
                                "& .ProseMirror": {
                                    outline: "none",
                                    minHeight: 400,
                                    // Placeholder
                                    "& p.is-editor-empty:first-child::before": {
                                        color: theme.palette.text.disabled,
                                        content: "attr(data-placeholder)",
                                        float: "left",
                                        height: 0,
                                        pointerEvents: "none",
                                    },
                                    // Headings
                                    "& h1": { fontSize: "2rem", fontWeight: "bold", marginTop: 16, marginBottom: 8 },
                                    "& h2": { fontSize: "1.5rem", fontWeight: "bold", marginTop: 16, marginBottom: 8 },
                                    "& h3": { fontSize: "1.25rem", fontWeight: "bold", marginTop: 12, marginBottom: 4 },
                                    "& h4": { fontSize: "1.1rem", fontWeight: "bold", marginTop: 8, marginBottom: 4 },
                                    // Lists
                                    "& ul, & ol": { paddingLeft: 24, marginTop: 8, marginBottom: 8 },
                                    "& li": { marginTop: 2, marginBottom: 2 },
                                    // Task list
                                    "& ul[data-type='taskList']": {
                                        listStyle: "none",
                                        paddingLeft: 0,
                                        "& li": {
                                            display: "flex",
                                            alignItems: "flex-start",
                                            gap: 8,
                                            "& > label": {
                                                flex: "0 0 auto",
                                                marginTop: 2,
                                            },
                                            "& > div": {
                                                flex: "1 1 auto",
                                            },
                                        },
                                    },
                                    // Blockquote
                                    "& blockquote": {
                                        borderLeft: `4px solid ${theme.palette.primary.main}`,
                                        paddingLeft: 16,
                                        marginLeft: 0,
                                        fontStyle: "italic",
                                        color: theme.palette.text.secondary,
                                    },
                                    // Code
                                    "& code": {
                                        backgroundColor: theme.palette.action.hover,
                                        borderRadius: "4px",
                                        padding: "2px 4px",
                                        fontFamily: "monospace",
                                    },
                                    // Code block
                                    "& pre": {
                                        backgroundColor: theme.palette.mode === "dark" ? "#2d2d2d" : "#f5f5f5",
                                        borderRadius: 8,
                                        padding: 16,
                                        overflow: "auto",
                                        "& code": {
                                            backgroundColor: "transparent",
                                            padding: 0,
                                        },
                                    },
                                    // Tables
                                    "& .tiptap-table": {
                                        borderCollapse: "collapse",
                                        width: "100%",
                                        marginTop: 16,
                                        marginBottom: 16,
                                        "& th, & td": {
                                            border: `1px solid ${theme.palette.divider}`,
                                            padding: 8,
                                            minWidth: 100,
                                            verticalAlign: "top",
                                        },
                                        "& th": {
                                            backgroundColor: theme.palette.action.hover,
                                            fontWeight: "bold",
                                        },
                                        "& .selectedCell": {
                                            backgroundColor: theme.palette.primary.light,
                                        },
                                    },
                                    // Images
                                    "& .tiptap-image": {
                                        maxWidth: "100%",
                                        height: "auto",
                                        borderRadius: 8,
                                        marginTop: 16,
                                        marginBottom: 16,
                                        display: "block",
                                        marginLeft: "auto",
                                        marginRight: "auto",
                                    },
                                    // Links
                                    "& .tiptap-link": {
                                        color: theme.palette.primary.main,
                                        textDecoration: "underline",
                                        cursor: "pointer",
                                    },
                                    // Highlight
                                    "& mark": {
                                        backgroundColor: theme.palette.warning.light,
                                        borderRadius: "2px",
                                        padding: "0 2px",
                                    },
                                    // Horizontal rule
                                    "& hr": {
                                        border: "none",
                                        borderTop: `2px solid ${theme.palette.divider}`,
                                        marginTop: 16,
                                        marginBottom: 16,
                                    },
                                },
                            }, children: _jsx(EditorContent, { editor: editor }) }) })] })] }));
};
export default BookPane;
