import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, IconButton, Tooltip, useTheme, ToggleButton, ToggleButtonGroup } from "@mui/material";
import GroupIcon from "@mui/icons-material/Group";
import HistoryIcon from "@mui/icons-material/History";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
const FocusModeControls = ({ focusModeActive, panelVisibility, onToggleFocusMode, onTogglePanel, }) => {
    const theme = useTheme();
    // Get selected panels as array for ToggleButtonGroup
    const selectedPanels = Object.entries(panelVisibility)
        .filter(([, visible]) => visible)
        .map(([key]) => key);
    const handlePanelChange = (_event, newPanels) => {
        const allPanels = ["collaboration", "versionHistory", "aiPane", "chapterNav"];
        allPanels.forEach((panel) => {
            const wasVisible = panelVisibility[panel];
            const isNowVisible = newPanels.includes(panel);
            if (wasVisible !== isNowVisible) {
                onTogglePanel(panel);
            }
        });
    };
    const topOffset = focusModeActive ? 16 : 72;
    return (_jsxs(Box, { sx: {
            position: "fixed",
            top: topOffset,
            right: 12,
            zIndex: 1300,
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            backgroundColor: theme.palette.background.paper,
            borderRadius: theme.spacing(1),
            boxShadow: 2,
            px: 0.75,
            py: 0.5,
        }, children: [!focusModeActive && (_jsxs(ToggleButtonGroup, { value: selectedPanels, onChange: handlePanelChange, size: "small", sx: {
                    "& .MuiToggleButton-root": {
                        px: 0.75,
                        py: 0.5,
                        border: "none",
                        borderRadius: "6px !important",
                        color: theme.palette.text.secondary,
                        "&.Mui-selected": {
                            backgroundColor: theme.palette.action.selected,
                            color: theme.palette.text.primary,
                        },
                        "&:hover": {
                            backgroundColor: theme.palette.action.hover,
                        },
                    },
                }, children: [_jsx(ToggleButton, { value: "chapterNav", "aria-label": "chapters", children: _jsx(Tooltip, { title: "Show/Hide Chapters", placement: "bottom", children: _jsx(MenuBookIcon, { fontSize: "small" }) }) }), _jsx(ToggleButton, { value: "aiPane", "aria-label": "ai assistant", children: _jsx(Tooltip, { title: "Show/Hide AI Assistant", placement: "bottom", children: _jsx(SmartToyIcon, { fontSize: "small" }) }) }), _jsx(ToggleButton, { value: "collaboration", "aria-label": "collaborators", children: _jsx(Tooltip, { title: "Show/Hide Collaborators", placement: "bottom", children: _jsx(GroupIcon, { fontSize: "small" }) }) }), _jsx(ToggleButton, { value: "versionHistory", "aria-label": "version history", children: _jsx(Tooltip, { title: "Show/Hide Version History", placement: "bottom", children: _jsx(HistoryIcon, { fontSize: "small" }) }) })] })), _jsx(Tooltip, { title: focusModeActive ? "Exit Focus Mode" : "Enter Focus Mode", placement: "bottom", children: _jsx(IconButton, { onClick: onToggleFocusMode, size: "small", sx: {
                        backgroundColor: focusModeActive
                            ? theme.palette.primary.main
                            : theme.palette.background.default,
                        color: focusModeActive
                            ? theme.palette.primary.contrastText
                            : theme.palette.text.secondary,
                        "&:hover": {
                            backgroundColor: focusModeActive
                                ? theme.palette.primary.dark
                                : theme.palette.action.hover,
                        },
                    }, children: focusModeActive ? (_jsx(FullscreenExitIcon, { fontSize: "small" })) : (_jsx(CenterFocusStrongIcon, { fontSize: "small" })) }) })] }));
};
export default FocusModeControls;
