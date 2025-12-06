import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AppBar, Toolbar, Typography, Button, Box } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
const TopBar = ({ projectTitle, onSave, onExport }) => {
    return (_jsx(AppBar, { position: "static", color: "default", elevation: 1, children: _jsxs(Toolbar, { children: [_jsx(Typography, { variant: "h6", sx: { flexGrow: 1 }, children: "\uD83D\uDCD6 Book Generation" }), _jsx(Typography, { variant: "subtitle1", sx: { mx: 2 }, children: projectTitle }), _jsxs(Box, { children: [_jsx(Button, { startIcon: _jsx(SaveIcon, {}), onClick: onSave, sx: { mr: 1 }, children: "Save" }), _jsx(Button, { startIcon: _jsx(FileDownloadIcon, {}), onClick: onExport, children: "Export" })] })] }) }));
};
export default TopBar;
