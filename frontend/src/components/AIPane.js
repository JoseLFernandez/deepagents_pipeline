import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * AIPane: AIChatWindow + SuggestionCards with Insert/Save actions.
 */
import { useState, useRef, useEffect } from "react";
import { Box, Typography, TextField, Button, Card, CardContent, CardActions, IconButton, Avatar, Paper, Chip, Divider, CircularProgress, useTheme, Fade, Tooltip, } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import AddIcon from "@mui/icons-material/Add";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import CloseIcon from "@mui/icons-material/Close";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ImageIcon from "@mui/icons-material/Image";
import SearchIcon from "@mui/icons-material/Search";
// Chat message bubble component
const ChatBubble = ({ message }) => {
    const theme = useTheme();
    const isUser = message.role === "user";
    return (_jsxs(Box, { sx: {
            display: "flex",
            justifyContent: isUser ? "flex-end" : "flex-start",
            mb: 2,
            gap: 1,
        }, children: [!isUser && (_jsx(Avatar, { sx: { bgcolor: theme.palette.secondary.main, width: 32, height: 32 }, children: _jsx(SmartToyIcon, { fontSize: "small" }) })), _jsxs(Paper, { elevation: 1, sx: {
                    px: 2,
                    py: 1.5,
                    maxWidth: "80%",
                    backgroundColor: isUser
                        ? theme.palette.primary.main
                        : theme.palette.mode === "dark"
                            ? theme.palette.grey[800]
                            : theme.palette.grey[100],
                    color: isUser ? theme.palette.primary.contrastText : theme.palette.text.primary,
                    borderRadius: 2,
                    borderTopLeftRadius: isUser ? 16 : 4,
                    borderTopRightRadius: isUser ? 4 : 16,
                }, children: [_jsx(Typography, { variant: "body2", sx: { whiteSpace: "pre-wrap" }, dangerouslySetInnerHTML: { __html: message.text } }), _jsx(Typography, { variant: "caption", sx: {
                            display: "block",
                            mt: 0.5,
                            opacity: 0.7,
                            textAlign: isUser ? "right" : "left",
                        }, children: new Date(message.timestamp).toLocaleTimeString() })] }), isUser && (_jsx(Avatar, { sx: { bgcolor: theme.palette.primary.dark, width: 32, height: 32 }, children: _jsx(PersonIcon, { fontSize: "small" }) }))] }));
};
// Suggestion card component
const SuggestionCard = ({ suggestion, onInsert, onDismiss, onSave }) => {
    const theme = useTheme();
    const typeColors = {
        rewrite: theme.palette.info.main,
        expand: theme.palette.success.main,
        expansion: theme.palette.success.main,
        summarize: theme.palette.warning.main,
        summary: theme.palette.warning.main,
        critique: theme.palette.error.main,
        generation: theme.palette.primary.main,
        reflection: theme.palette.warning.dark,
        editor: theme.palette.success.dark,
        image: theme.palette.secondary.main,
        other: theme.palette.grey[600],
    };
    const label = suggestion.stage
        ? `${suggestion.stage.toUpperCase()}${typeof suggestion.stageOrder === "number" ? ` · Step ${suggestion.stageOrder + 1}` : ""}`
        : suggestion.type.toUpperCase();
    const colorKey = suggestion.stage ?? suggestion.type;
    return (_jsxs(Card, { sx: {
            mb: 1.5,
            borderLeft: `4px solid ${typeColors[colorKey] || theme.palette.grey[500]}`,
            "&:hover": {
                boxShadow: 3,
            },
            transition: "box-shadow 0.2s",
        }, children: [_jsxs(CardContent, { sx: { pb: 1 }, children: [_jsxs(Box, { sx: { display: "flex", alignItems: "center", gap: 1, mb: 1 }, children: [_jsx(AutoAwesomeIcon, { fontSize: "small", color: "action" }), _jsx(Chip, { label: label, size: "small", sx: {
                                    backgroundColor: typeColors[colorKey] || theme.palette.grey[500],
                                    color: "#fff",
                                    fontWeight: "bold",
                                    fontSize: "0.65rem",
                                } })] }), _jsx(Typography, { variant: "body2", sx: { whiteSpace: "pre-wrap" }, children: suggestion.text }), suggestion.notes && (_jsx(Typography, { variant: "caption", color: "text.secondary", sx: { mt: 1, display: "block" }, children: suggestion.notes }))] }), _jsxs(CardActions, { sx: { pt: 0, px: 2, pb: 1.5 }, children: [_jsx(Button, { size: "small", variant: "contained", startIcon: _jsx(AddIcon, {}), onClick: onInsert, sx: { textTransform: "none" }, children: "Insert" }), onSave && (_jsx(Button, { size: "small", variant: "outlined", startIcon: _jsx(BookmarkIcon, {}), onClick: onSave, sx: { textTransform: "none" }, children: "Save" })), _jsx(IconButton, { size: "small", onClick: onDismiss, sx: { ml: "auto" }, children: _jsx(CloseIcon, { fontSize: "small" }) })] })] }));
};
const AIPane = ({ messages, suggestions, loading, onSendMessage, onInsertSuggestion, onDismissSuggestion, onSaveSuggestion, onGenerateImage, onSearchWeb, }) => {
    const theme = useTheme();
    const [input, setInput] = useState("");
    const chatEndRef = useRef(null);
    // Auto-scroll to bottom on new messages
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);
    const handleSend = () => {
        if (input.trim()) {
            onSendMessage(input.trim());
            setInput("");
        }
    };
    const handleGenerateImage = () => {
        if (input.trim() && onGenerateImage) {
            onGenerateImage(input.trim());
            setInput("");
        }
    };
    const handleSearchWeb = () => {
        if (input.trim() && onSearchWeb) {
            onSearchWeb(input.trim());
            setInput("");
        }
    };
    return (_jsxs(Box, { sx: { display: "flex", flexDirection: "column", height: "100%", width: "100%", minHeight: 0, overflow: "hidden" }, children: [_jsxs(Box, { sx: {
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    p: 1.5,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                }, children: [_jsx(SmartToyIcon, { color: "primary" }), _jsx(Typography, { variant: "h6", sx: { flex: 1 }, children: "AI Assistant" }), onSearchWeb && (_jsx(Tooltip, { title: "Search web with Perplexity AI", children: _jsx(IconButton, { size: "small", onClick: handleSearchWeb, disabled: loading || !input.trim(), color: "primary", children: _jsx(SearchIcon, { fontSize: "small" }) }) })), onGenerateImage && (_jsx(Tooltip, { title: "Generate image with Picsart AI", children: _jsx(IconButton, { size: "small", onClick: handleGenerateImage, disabled: loading || !input.trim(), color: "primary", children: _jsx(ImageIcon, { fontSize: "small" }) }) }))] }), _jsxs(Box, { sx: {
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    p: 2,
                    backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[50],
                }, children: [messages.length === 0 && (_jsxs(Box, { sx: {
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "100%",
                            opacity: 0.6,
                        }, children: [_jsx(SmartToyIcon, { sx: { fontSize: 48, mb: 1 } }), _jsx(Typography, { variant: "body2", color: "text.secondary", children: "Ask me to rewrite, expand, summarize, or critique your text." })] })), messages.map((msg) => (_jsx(ChatBubble, { message: msg }, msg.id))), loading && (_jsxs(Box, { sx: { display: "flex", alignItems: "center", gap: 1, ml: 5 }, children: [_jsx(CircularProgress, { size: 16 }), _jsx(Typography, { variant: "body2", color: "text.secondary", children: "Thinking..." })] })), _jsx("div", { ref: chatEndRef })] }), _jsxs(Box, { sx: {
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                    p: 1.5,
                    borderTop: `1px solid ${theme.palette.divider}`,
                    backgroundColor: theme.palette.background.paper,
                }, children: [_jsx(TextField, { sx: { flex: 1, minWidth: 150 }, size: "small", placeholder: "Ask AI, search the web, or describe an image to generate...", value: input, onChange: (e) => setInput(e.target.value), onKeyDown: (e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }, disabled: loading, multiline: true, maxRows: 3 }), _jsxs(Box, { sx: { display: "flex", gap: 1, flexShrink: 0 }, children: [onSearchWeb && (_jsx(Tooltip, { title: "Search web with Perplexity AI", children: _jsx("span", { children: _jsx(Button, { variant: "outlined", onClick: handleSearchWeb, disabled: loading || !input.trim(), sx: { minWidth: 40, px: 1 }, children: _jsx(SearchIcon, {}) }) }) })), onGenerateImage && (_jsx(Tooltip, { title: "Generate image with Picsart AI", children: _jsx("span", { children: _jsx(Button, { variant: "outlined", onClick: handleGenerateImage, disabled: loading || !input.trim(), sx: { minWidth: 40, px: 1 }, children: _jsx(ImageIcon, {}) }) }) })), _jsx(Button, { variant: "contained", onClick: handleSend, disabled: loading || !input.trim(), sx: { minWidth: 40, px: 1.5 }, children: _jsx(SendIcon, {}) })] })] }), suggestions.length > 0 && (_jsxs(_Fragment, { children: [_jsx(Divider, {}), _jsxs(Box, { sx: {
                            p: 1.5,
                            maxHeight: 250,
                            overflowY: "auto",
                            backgroundColor: theme.palette.background.paper,
                        }, children: [_jsxs(Typography, { variant: "subtitle2", sx: { mb: 1, fontWeight: "bold" }, children: ["Suggestions (", suggestions.length, ")"] }), suggestions.map((s) => (_jsx(Fade, { in: true, children: _jsx("div", { children: _jsx(SuggestionCard, { suggestion: s, onInsert: () => onInsertSuggestion(s), onDismiss: () => onDismissSuggestion(s.id), onSave: onSaveSuggestion ? () => onSaveSuggestion(s) : undefined }) }) }, s.id)))] })] }))] }));
};
export default AIPane;
