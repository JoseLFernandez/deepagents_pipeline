import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AppBar, Toolbar, Button, ToggleButtonGroup, ToggleButton, Box, Tooltip, Divider, useTheme, } from "@mui/material";
import GroupIcon from "@mui/icons-material/Group";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DescriptionIcon from "@mui/icons-material/Description";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import SummarizeIcon from "@mui/icons-material/Summarize";
const BottomBar = ({ aiMode, onAIModeChange, onExportPDF, onExportDOCX, onCollaborate, }) => {
    const theme = useTheme();
    return (_jsx(AppBar, { position: "fixed", color: "default", sx: {
            top: "auto",
            bottom: 0,
            borderTop: `1px solid ${theme.palette.divider}`,
        }, elevation: 0, children: _jsxs(Toolbar, { variant: "dense", sx: { justifyContent: "space-between" }, children: [_jsxs(Box, { sx: { display: "flex", alignItems: "center", gap: 1 }, children: [_jsx(Tooltip, { title: "Export as PDF", children: _jsx(Button, { startIcon: _jsx(PictureAsPdfIcon, {}), onClick: onExportPDF, size: "small", sx: { textTransform: "none" }, children: "PDF" }) }), _jsx(Tooltip, { title: "Export as DOCX", children: _jsx(Button, { startIcon: _jsx(DescriptionIcon, {}), onClick: onExportDOCX, size: "small", sx: { textTransform: "none" }, children: "DOCX" }) }), _jsx(Divider, { orientation: "vertical", flexItem: true, sx: { mx: 1 } }), _jsx(Tooltip, { title: "Invite collaborators", children: _jsx(Button, { startIcon: _jsx(GroupIcon, {}), onClick: onCollaborate, size: "small", sx: { textTransform: "none" }, children: "Collaborate" }) })] }), _jsxs(Box, { sx: { display: "flex", alignItems: "center", gap: 1 }, children: [_jsx(Box, { component: "span", sx: { fontSize: "0.75rem", color: theme.palette.text.secondary, mr: 1 }, children: "AI Mode:" }), _jsxs(ToggleButtonGroup, { value: aiMode, exclusive: true, onChange: (_, value) => value && onAIModeChange(value), size: "small", sx: {
                                "& .MuiToggleButton-root": {
                                    textTransform: "none",
                                    px: 1.5,
                                },
                            }, children: [_jsx(ToggleButton, { value: "creative", children: _jsx(Tooltip, { title: "Creative writing mode", children: _jsxs(Box, { sx: { display: "flex", alignItems: "center", gap: 0.5 }, children: [_jsx(AutoFixHighIcon, { fontSize: "small" }), "Creative"] }) }) }), _jsx(ToggleButton, { value: "factual", children: _jsx(Tooltip, { title: "Factual, research-focused mode", children: _jsxs(Box, { sx: { display: "flex", alignItems: "center", gap: 0.5 }, children: [_jsx(FactCheckIcon, { fontSize: "small" }), "Factual"] }) }) }), _jsx(ToggleButton, { value: "summarize", children: _jsx(Tooltip, { title: "Summarization mode", children: _jsxs(Box, { sx: { display: "flex", alignItems: "center", gap: 0.5 }, children: [_jsx(SummarizeIcon, { fontSize: "small" }), "Summarize"] }) }) })] })] })] }) }));
};
export default BottomBar;
