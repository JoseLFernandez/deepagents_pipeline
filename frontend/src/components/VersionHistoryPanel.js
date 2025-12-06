import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * VersionHistoryPanel: Collapsible panel showing version history with restore capability.
 */
import { useState } from "react";
import { Box, Typography, List, ListItemButton, ListItemText, ListItemIcon, IconButton, Tooltip, Collapse, Chip, Divider, Button, Dialog, DialogTitle, DialogContent, DialogActions, useTheme, } from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import RestoreIcon from "@mui/icons-material/Restore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PersonIcon from "@mui/icons-material/Person";
import AutoSaveIcon from "@mui/icons-material/CloudDone";
import CompareIcon from "@mui/icons-material/Compare";
const VersionHistoryPanel = ({ versions, onRestore, onCompare, collapsed = false, onToggleCollapse, }) => {
    const theme = useTheme();
    const [selectedVersion, setSelectedVersion] = useState(null);
    const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
    const [expandedChapters, setExpandedChapters] = useState(new Set());
    // Group versions by chapter
    const versionsByChapter = versions.reduce((acc, v) => {
        if (!acc[v.chapterId])
            acc[v.chapterId] = [];
        acc[v.chapterId].push(v);
        return acc;
    }, {});
    const toggleChapter = (chapterId) => {
        setExpandedChapters((prev) => {
            const next = new Set(prev);
            if (next.has(chapterId)) {
                next.delete(chapterId);
            }
            else {
                next.add(chapterId);
            }
            return next;
        });
    };
    const handleRestoreClick = (version) => {
        setSelectedVersion(version);
        setRestoreDialogOpen(true);
    };
    const handleConfirmRestore = () => {
        if (selectedVersion) {
            onRestore(selectedVersion);
        }
        setRestoreDialogOpen(false);
        setSelectedVersion(null);
    };
    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 1)
            return "Just now";
        if (diffMins < 60)
            return `${diffMins}m ago`;
        if (diffHours < 24)
            return `${diffHours}h ago`;
        if (diffDays < 7)
            return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };
    const getTypeIcon = (type) => {
        switch (type) {
            case "auto":
                return _jsx(AutoSaveIcon, { fontSize: "small", color: "action" });
            case "collaboration":
                return _jsx(PersonIcon, { fontSize: "small", color: "primary" });
            default:
                return _jsx(HistoryIcon, { fontSize: "small", color: "action" });
        }
    };
    const getTypeColor = (type) => {
        switch (type) {
            case "auto":
                return "default";
            case "collaboration":
                return "primary";
            default:
                return "secondary";
        }
    };
    if (collapsed) {
        return (_jsx(Tooltip, { title: "Version History", placement: "left", children: _jsx(IconButton, { onClick: onToggleCollapse, sx: {
                    position: "fixed",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    backgroundColor: theme.palette.background.paper,
                    boxShadow: 2,
                    zIndex: 1000,
                    "&:hover": {
                        backgroundColor: theme.palette.action.hover,
                    },
                }, children: _jsx(HistoryIcon, {}) }) }));
    }
    return (_jsxs(_Fragment, { children: [_jsxs(Box, { sx: {
                    width: 240,
                    minWidth: 200,
                    flexShrink: 0,
                    height: "100%",
                    borderLeft: `1px solid ${theme.palette.divider}`,
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
                        }, children: [_jsxs(Box, { sx: { display: "flex", alignItems: "center", gap: 1 }, children: [_jsx(HistoryIcon, { fontSize: "small" }), _jsx(Typography, { variant: "subtitle2", fontWeight: "bold", children: "Version History" })] }), _jsx(IconButton, { size: "small", onClick: onToggleCollapse, children: _jsx(ExpandMoreIcon, { sx: { transform: "rotate(90deg)" } }) })] }), _jsx(Box, { sx: { flex: 1, overflowY: "auto" }, children: Object.entries(versionsByChapter).length === 0 ? (_jsx(Box, { sx: { p: 2, textAlign: "center" }, children: _jsx(Typography, { variant: "body2", color: "text.secondary", children: "No versions yet. Changes will be saved automatically." }) })) : (Object.entries(versionsByChapter).map(([chapterId, chapterVersions]) => (_jsxs(Box, { children: [_jsxs(ListItemButton, { onClick: () => toggleChapter(Number(chapterId)), sx: { py: 0.5 }, children: [_jsx(ListItemText, { primary: chapterVersions[0]?.chapterTitle || `Chapter ${chapterId}`, primaryTypographyProps: { variant: "body2", fontWeight: "medium" }, secondary: `${chapterVersions.length} versions`, secondaryTypographyProps: { variant: "caption" } }), expandedChapters.has(Number(chapterId)) ? (_jsx(ExpandLessIcon, { fontSize: "small" })) : (_jsx(ExpandMoreIcon, { fontSize: "small" }))] }), _jsx(Collapse, { in: expandedChapters.has(Number(chapterId)), children: _jsx(List, { dense: true, disablePadding: true, sx: { pl: 2 }, children: chapterVersions.slice(0, 10).map((version) => (_jsxs(ListItemButton, { sx: {
                                                py: 0.5,
                                                borderRadius: 1,
                                                mx: 0.5,
                                                "&:hover .version-actions": {
                                                    opacity: 1,
                                                },
                                            }, children: [_jsx(ListItemIcon, { sx: { minWidth: 28 }, children: getTypeIcon(version.type) }), _jsx(ListItemText, { primary: _jsxs(Box, { sx: { display: "flex", alignItems: "center", gap: 0.5 }, children: [_jsx(Typography, { variant: "caption", children: formatTime(version.timestamp) }), version.label && (_jsx(Chip, { label: version.label, size: "small", color: getTypeColor(version.type), sx: { height: 16, fontSize: "0.65rem" } }))] }), secondary: version.author, secondaryTypographyProps: { variant: "caption" } }), _jsxs(Box, { className: "version-actions", sx: {
                                                        opacity: 0,
                                                        transition: "opacity 0.2s",
                                                        display: "flex",
                                                        gap: 0.5,
                                                    }, children: [onCompare && (_jsx(Tooltip, { title: "Compare", children: _jsx(IconButton, { size: "small", onClick: (e) => {
                                                                    e.stopPropagation();
                                                                    onCompare(version);
                                                                }, children: _jsx(CompareIcon, { fontSize: "small" }) }) })), _jsx(Tooltip, { title: "Restore", children: _jsx(IconButton, { size: "small", onClick: (e) => {
                                                                    e.stopPropagation();
                                                                    handleRestoreClick(version);
                                                                }, children: _jsx(RestoreIcon, { fontSize: "small" }) }) })] })] }, version.id))) }) }), _jsx(Divider, {})] }, chapterId)))) })] }), _jsxs(Dialog, { open: restoreDialogOpen, onClose: () => setRestoreDialogOpen(false), children: [_jsx(DialogTitle, { children: "Restore Version?" }), _jsxs(DialogContent, { children: [_jsxs(Typography, { variant: "body2", children: ["This will replace the current content of \"", selectedVersion?.chapterTitle, "\" with the version from ", selectedVersion && formatTime(selectedVersion.timestamp), "."] }), _jsx(Typography, { variant: "body2", color: "text.secondary", sx: { mt: 1 }, children: "A backup of your current content will be saved automatically." })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: () => setRestoreDialogOpen(false), children: "Cancel" }), _jsx(Button, { onClick: handleConfirmRestore, variant: "contained", color: "primary", children: "Restore" })] })] })] }));
};
export default VersionHistoryPanel;
