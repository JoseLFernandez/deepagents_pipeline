import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * EditorToolbar: Rich formatting toolbar for Tiptap editor.
 */
import { useCallback } from "react";
import { Box, IconButton, Divider, Tooltip, Select, MenuItem, FormControl, useTheme, } from "@mui/material";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import StrikethroughSIcon from "@mui/icons-material/StrikethroughS";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import ChecklistIcon from "@mui/icons-material/Checklist";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import CodeIcon from "@mui/icons-material/Code";
import DataObjectIcon from "@mui/icons-material/DataObject";
import TableChartIcon from "@mui/icons-material/TableChart";
import ImageIcon from "@mui/icons-material/Image";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import FormatAlignJustifyIcon from "@mui/icons-material/FormatAlignJustify";
import HighlightIcon from "@mui/icons-material/Highlight";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule";
const EditorToolbar = ({ editor }) => {
    const theme = useTheme();
    const addImage = useCallback(() => {
        if (!editor)
            return;
        const url = window.prompt("Enter image URL:");
        if (url) {
            editor.chain().focus().setImage({ src: url }).run();
        }
    }, [editor]);
    const setLink = useCallback(() => {
        if (!editor)
            return;
        const previousUrl = editor.getAttributes("link").href;
        const url = window.prompt("Enter URL:", previousUrl);
        if (url === null)
            return;
        if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
        }
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }, [editor]);
    const addTable = useCallback(() => {
        if (!editor)
            return;
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    }, [editor]);
    if (!editor) {
        return null;
    }
    const ToolbarButton = ({ onClick, isActive, disabled, title, children }) => (_jsx(Tooltip, { title: title, arrow: true, children: _jsx("span", { children: _jsx(IconButton, { size: "small", onClick: onClick, disabled: disabled, sx: {
                    borderRadius: 1,
                    backgroundColor: isActive ? theme.palette.action.selected : "transparent",
                    "&:hover": {
                        backgroundColor: theme.palette.action.hover,
                    },
                }, children: children }) }) }));
    const ToolbarDivider = () => (_jsx(Divider, { orientation: "vertical", flexItem: true, sx: { mx: 0.5, my: 0.5 } }));
    return (_jsxs(Box, { sx: {
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 0.25,
            p: 0.5,
            borderBottom: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
        }, children: [_jsx(ToolbarButton, { onClick: () => editor.chain().focus().undo().run(), disabled: !editor.can().undo(), title: "Undo (Ctrl+Z)", children: _jsx(UndoIcon, { fontSize: "small" }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().redo().run(), disabled: !editor.can().redo(), title: "Redo (Ctrl+Y)", children: _jsx(RedoIcon, { fontSize: "small" }) }), _jsx(ToolbarDivider, {}), _jsx(FormControl, { size: "small", sx: { minWidth: 100 }, children: _jsxs(Select, { value: editor.isActive("heading", { level: 1 })
                        ? "1"
                        : editor.isActive("heading", { level: 2 })
                            ? "2"
                            : editor.isActive("heading", { level: 3 })
                                ? "3"
                                : editor.isActive("heading", { level: 4 })
                                    ? "4"
                                    : "p", onChange: (e) => {
                        const value = e.target.value;
                        if (value === "p") {
                            editor.chain().focus().setParagraph().run();
                        }
                        else {
                            editor.chain().focus().toggleHeading({ level: parseInt(value) }).run();
                        }
                    }, sx: { fontSize: "0.8rem", height: 32 }, children: [_jsx(MenuItem, { value: "p", children: "Paragraph" }), _jsx(MenuItem, { value: "1", children: "Heading 1" }), _jsx(MenuItem, { value: "2", children: "Heading 2" }), _jsx(MenuItem, { value: "3", children: "Heading 3" }), _jsx(MenuItem, { value: "4", children: "Heading 4" })] }) }), _jsx(ToolbarDivider, {}), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().toggleBold().run(), isActive: editor.isActive("bold"), title: "Bold (Ctrl+B)", children: _jsx(FormatBoldIcon, { fontSize: "small" }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().toggleItalic().run(), isActive: editor.isActive("italic"), title: "Italic (Ctrl+I)", children: _jsx(FormatItalicIcon, { fontSize: "small" }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().toggleUnderline().run(), isActive: editor.isActive("underline"), title: "Underline (Ctrl+U)", children: _jsx(FormatUnderlinedIcon, { fontSize: "small" }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().toggleStrike().run(), isActive: editor.isActive("strike"), title: "Strikethrough", children: _jsx(StrikethroughSIcon, { fontSize: "small" }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().toggleHighlight().run(), isActive: editor.isActive("highlight"), title: "Highlight", children: _jsx(HighlightIcon, { fontSize: "small" }) }), _jsx(ToolbarDivider, {}), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().setTextAlign("left").run(), isActive: editor.isActive({ textAlign: "left" }), title: "Align Left", children: _jsx(FormatAlignLeftIcon, { fontSize: "small" }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().setTextAlign("center").run(), isActive: editor.isActive({ textAlign: "center" }), title: "Align Center", children: _jsx(FormatAlignCenterIcon, { fontSize: "small" }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().setTextAlign("right").run(), isActive: editor.isActive({ textAlign: "right" }), title: "Align Right", children: _jsx(FormatAlignRightIcon, { fontSize: "small" }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().setTextAlign("justify").run(), isActive: editor.isActive({ textAlign: "justify" }), title: "Justify", children: _jsx(FormatAlignJustifyIcon, { fontSize: "small" }) }), _jsx(ToolbarDivider, {}), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().toggleBulletList().run(), isActive: editor.isActive("bulletList"), title: "Bullet List", children: _jsx(FormatListBulletedIcon, { fontSize: "small" }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().toggleOrderedList().run(), isActive: editor.isActive("orderedList"), title: "Numbered List", children: _jsx(FormatListNumberedIcon, { fontSize: "small" }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().toggleTaskList().run(), isActive: editor.isActive("taskList"), title: "Task List", children: _jsx(ChecklistIcon, { fontSize: "small" }) }), _jsx(ToolbarDivider, {}), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().toggleBlockquote().run(), isActive: editor.isActive("blockquote"), title: "Block Quote", children: _jsx(FormatQuoteIcon, { fontSize: "small" }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().toggleCode().run(), isActive: editor.isActive("code"), title: "Inline Code", children: _jsx(CodeIcon, { fontSize: "small" }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().toggleCodeBlock().run(), isActive: editor.isActive("codeBlock"), title: "Code Block", children: _jsx(DataObjectIcon, { fontSize: "small" }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().setHorizontalRule().run(), title: "Horizontal Rule", children: _jsx(HorizontalRuleIcon, { fontSize: "small" }) }), _jsx(ToolbarDivider, {}), _jsx(ToolbarButton, { onClick: setLink, isActive: editor.isActive("link"), title: "Add Link", children: _jsx(LinkIcon, { fontSize: "small" }) }), editor.isActive("link") && (_jsx(ToolbarButton, { onClick: () => editor.chain().focus().unsetLink().run(), title: "Remove Link", children: _jsx(LinkOffIcon, { fontSize: "small" }) })), _jsx(ToolbarButton, { onClick: addImage, title: "Insert Image", children: _jsx(ImageIcon, { fontSize: "small" }) }), _jsx(ToolbarButton, { onClick: addTable, title: "Insert Table", children: _jsx(TableChartIcon, { fontSize: "small" }) })] }));
};
export default EditorToolbar;
