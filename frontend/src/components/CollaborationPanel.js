import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * CollaborationPanel: Real-time collaboration features with presence, cursors, and chat.
 */
import { useState } from "react";
import { Box, Typography, List, ListItem, ListItemButton, ListItemAvatar, ListItemText, Avatar, IconButton, Tooltip, TextField, Badge, Chip, Divider, Button, Dialog, DialogTitle, DialogContent, DialogActions, useTheme, Fade, } from "@mui/material";
import GroupIcon from "@mui/icons-material/Group";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import ChatIcon from "@mui/icons-material/Chat";
import SendIcon from "@mui/icons-material/Send";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import CircleIcon from "@mui/icons-material/Circle";
const CollaborationPanel = ({ collaborators, messages, currentUserId, sessionId, onInvite, onSendMessage, onJumpToCollaborator, collapsed = false, onToggleCollapse, }) => {
    const theme = useTheme();
    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [chatInput, setChatInput] = useState("");
    const [copied, setCopied] = useState(false);
    const [showChat, setShowChat] = useState(true);
    const onlineCount = collaborators.filter((c) => c.status === "online").length;
    const handleInvite = () => {
        if (inviteEmail.trim()) {
            onInvite(inviteEmail.trim());
            setInviteEmail("");
            setInviteDialogOpen(false);
        }
    };
    const handleSendMessage = () => {
        if (chatInput.trim()) {
            onSendMessage(chatInput.trim());
            setChatInput("");
        }
    };
    const handleCopyLink = () => {
        const link = `${window.location.origin}/collab/${sessionId}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    const getStatusColor = (status) => {
        switch (status) {
            case "online":
                return theme.palette.success.main;
            case "away":
                return theme.palette.warning.main;
            default:
                return theme.palette.grey[500];
        }
    };
    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
    };
    if (collapsed) {
        return (_jsx(Tooltip, { title: `Collaborators (${onlineCount} online)`, placement: "right", children: _jsx(IconButton, { onClick: onToggleCollapse, sx: {
                    position: "fixed",
                    left: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    backgroundColor: theme.palette.background.paper,
                    boxShadow: 2,
                    zIndex: 1000,
                    "&:hover": {
                        backgroundColor: theme.palette.action.hover,
                    },
                }, children: _jsx(Badge, { badgeContent: onlineCount, color: "success", children: _jsx(GroupIcon, {}) }) }) }));
    }
    return (_jsxs(_Fragment, { children: [_jsxs(Box, { sx: {
                    width: 240,
                    minWidth: 200,
                    flexShrink: 0,
                    height: "100%",
                    borderRight: `1px solid ${theme.palette.divider}`,
                    backgroundColor: theme.palette.background.paper,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                }, children: [_jsxs(Box, { sx: {
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            p: 1.5,
                            borderBottom: `1px solid ${theme.palette.divider}`,
                        }, children: [_jsxs(Box, { sx: { display: "flex", alignItems: "center", gap: 1 }, children: [_jsx(GroupIcon, { fontSize: "small" }), _jsx(Typography, { variant: "subtitle2", fontWeight: "bold", children: "Collaborators" }), _jsx(Chip, { label: `${onlineCount} online`, size: "small", color: "success", sx: { height: 20, fontSize: "0.7rem" } })] }), _jsxs(Box, { children: [_jsx(Tooltip, { title: "Invite", children: _jsx(IconButton, { size: "small", onClick: () => setInviteDialogOpen(true), children: _jsx(PersonAddIcon, { fontSize: "small" }) }) }), _jsx(IconButton, { size: "small", onClick: onToggleCollapse, children: _jsx(ExpandMoreIcon, { sx: { transform: "rotate(-90deg)" } }) })] })] }), sessionId && (_jsxs(Box, { sx: {
                            p: 1,
                            backgroundColor: theme.palette.action.hover,
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                        }, children: [_jsxs(Typography, { variant: "caption", sx: { flex: 1 }, noWrap: true, children: ["Session: ", sessionId.slice(0, 8), "..."] }), _jsx(Tooltip, { title: copied ? "Copied!" : "Copy invite link", children: _jsx(IconButton, { size: "small", onClick: handleCopyLink, children: copied ? (_jsx(CheckIcon, { fontSize: "small", color: "success" })) : (_jsx(ContentCopyIcon, { fontSize: "small" })) }) })] })), _jsx(List, { dense: true, sx: { flex: showChat ? "0 0 auto" : 1, overflowY: "auto", maxHeight: showChat ? 200 : "none" }, children: collaborators.map((collaborator) => (_jsxs(ListItem, { secondaryAction: collaborator.id !== currentUserId && onJumpToCollaborator && (_jsx(Tooltip, { title: "Jump to their location", children: _jsx(IconButton, { size: "small", onClick: () => onJumpToCollaborator(collaborator), children: _jsx(CircleIcon, { sx: { fontSize: 12, color: collaborator.color } }) }) })), sx: {
                                "&:hover": {
                                    backgroundColor: theme.palette.action.hover,
                                },
                            }, children: [_jsx(ListItemAvatar, { sx: { minWidth: 40 }, children: _jsx(Badge, { overlap: "circular", anchorOrigin: { vertical: "bottom", horizontal: "right" }, badgeContent: _jsx(CircleIcon, { sx: {
                                                fontSize: 10,
                                                color: getStatusColor(collaborator.status),
                                                backgroundColor: theme.palette.background.paper,
                                                borderRadius: "50%",
                                            } }), children: _jsx(Avatar, { src: collaborator.avatar, sx: {
                                                width: 32,
                                                height: 32,
                                                fontSize: "0.875rem",
                                                backgroundColor: collaborator.color,
                                            }, children: collaborator.name[0].toUpperCase() }) }) }), _jsx(ListItemText, { primary: _jsxs(Box, { sx: { display: "flex", alignItems: "center", gap: 0.5 }, children: [_jsx(Typography, { variant: "body2", noWrap: true, children: collaborator.name }), collaborator.id === currentUserId && (_jsx(Chip, { label: "You", size: "small", sx: { height: 16, fontSize: "0.6rem" } }))] }), secondary: collaborator.currentChapter
                                        ? `Editing Chapter ${collaborator.currentChapter}`
                                        : collaborator.status, secondaryTypographyProps: { variant: "caption" } })] }, collaborator.id))) }), _jsx(Divider, {}), _jsxs(ListItemButton, { onClick: () => setShowChat(!showChat), sx: { py: 0.5 }, children: [_jsx(ListItemAvatar, { sx: { minWidth: 32 }, children: _jsx(ChatIcon, { fontSize: "small" }) }), _jsx(ListItemText, { primary: "Team Chat", primaryTypographyProps: { variant: "body2" } }), _jsx(ExpandMoreIcon, { sx: {
                                    transform: showChat ? "rotate(180deg)" : "rotate(0deg)",
                                    transition: "transform 0.2s",
                                } })] }), _jsx(Fade, { in: showChat, children: _jsxs(Box, { sx: {
                                flex: 1,
                                display: showChat ? "flex" : "none",
                                flexDirection: "column",
                                minHeight: 0,
                            }, children: [_jsx(Box, { sx: {
                                        flex: 1,
                                        overflowY: "auto",
                                        p: 1,
                                        backgroundColor: theme.palette.mode === "dark"
                                            ? theme.palette.grey[900]
                                            : theme.palette.grey[50],
                                    }, children: messages.length === 0 ? (_jsx(Typography, { variant: "caption", color: "text.secondary", sx: { display: "block", textAlign: "center", mt: 2 }, children: "No messages yet. Start the conversation!" })) : (messages.map((msg) => (_jsxs(Box, { sx: {
                                            mb: 1,
                                            p: 1,
                                            backgroundColor: theme.palette.background.paper,
                                            borderRadius: 1,
                                            borderLeft: `3px solid ${collaborators.find((c) => c.id === msg.authorId)?.color ||
                                                theme.palette.grey[500]}`,
                                        }, children: [_jsxs(Box, { sx: {
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    mb: 0.5,
                                                }, children: [_jsx(Typography, { variant: "caption", fontWeight: "bold", children: msg.authorName }), _jsx(Typography, { variant: "caption", color: "text.secondary", children: formatTime(msg.timestamp) })] }), _jsx(Typography, { variant: "body2", children: msg.text })] }, msg.id)))) }), _jsxs(Box, { sx: {
                                        display: "flex",
                                        gap: 0.5,
                                        p: 1,
                                        borderTop: `1px solid ${theme.palette.divider}`,
                                    }, children: [_jsx(TextField, { size: "small", placeholder: "Message...", value: chatInput, onChange: (e) => setChatInput(e.target.value), onKeyDown: (e) => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSendMessage();
                                                }
                                            }, fullWidth: true, sx: { "& .MuiInputBase-input": { fontSize: "0.875rem" } } }), _jsx(IconButton, { size: "small", onClick: handleSendMessage, disabled: !chatInput.trim(), color: "primary", children: _jsx(SendIcon, { fontSize: "small" }) })] })] }) })] }), _jsxs(Dialog, { open: inviteDialogOpen, onClose: () => setInviteDialogOpen(false), maxWidth: "xs", fullWidth: true, children: [_jsx(DialogTitle, { children: "Invite Collaborator" }), _jsxs(DialogContent, { children: [_jsx(TextField, { autoFocus: true, label: "Email address", type: "email", fullWidth: true, value: inviteEmail, onChange: (e) => setInviteEmail(e.target.value), placeholder: "colleague@example.com", sx: { mt: 1 } }), sessionId && (_jsxs(Box, { sx: { mt: 2 }, children: [_jsx(Typography, { variant: "body2", color: "text.secondary", gutterBottom: true, children: "Or share this link:" }), _jsxs(Box, { sx: {
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                            p: 1,
                                            backgroundColor: theme.palette.action.hover,
                                            borderRadius: 1,
                                        }, children: [_jsx(Typography, { variant: "caption", sx: { flex: 1 }, noWrap: true, children: `${window.location.origin}/collab/${sessionId}` }), _jsx(IconButton, { size: "small", onClick: handleCopyLink, children: copied ? (_jsx(CheckIcon, { fontSize: "small", color: "success" })) : (_jsx(ContentCopyIcon, { fontSize: "small" })) })] })] }))] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: () => setInviteDialogOpen(false), children: "Cancel" }), _jsx(Button, { onClick: handleInvite, variant: "contained", disabled: !inviteEmail.trim(), children: "Send Invite" })] })] })] }));
};
export default CollaborationPanel;
