/**
 * FocusModeControls: Compact toggle buttons for panel visibility.
 */
import React from "react";
import { Box, IconButton, Tooltip, useTheme, ToggleButton, ToggleButtonGroup } from "@mui/material";
import GroupIcon from "@mui/icons-material/Group";
import HistoryIcon from "@mui/icons-material/History";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";

export interface PanelVisibility {
  collaboration: boolean;
  versionHistory: boolean;
  aiPane: boolean;
  chapterNav: boolean;
}

interface FocusModeControlsProps {
  focusModeActive: boolean;
  panelVisibility: PanelVisibility;
  onToggleFocusMode: () => void;
  onTogglePanel: (panel: keyof PanelVisibility) => void;
}

const FocusModeControls: React.FC<FocusModeControlsProps> = ({
  focusModeActive,
  panelVisibility,
  onToggleFocusMode,
  onTogglePanel,
}) => {
  const theme = useTheme();

  // Get selected panels as array for ToggleButtonGroup
  const selectedPanels = Object.entries(panelVisibility)
    .filter(([, visible]) => visible)
    .map(([key]) => key);

  const handlePanelChange = (
    _event: React.MouseEvent<HTMLElement>,
    newPanels: string[]
  ) => {
    const allPanels: (keyof PanelVisibility)[] = ["collaboration", "versionHistory", "aiPane", "chapterNav"];
    allPanels.forEach((panel) => {
      const wasVisible = panelVisibility[panel];
      const isNowVisible = newPanels.includes(panel);
      if (wasVisible !== isNowVisible) {
        onTogglePanel(panel);
      }
    });
  };

  const topOffset = focusModeActive ? 16 : 72;

  return (
    <Box
      sx={{
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
      }}
    >
      {!focusModeActive && (
        <ToggleButtonGroup
          value={selectedPanels}
          onChange={handlePanelChange}
          size="small"
          sx={{
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
          }}
        >
          <ToggleButton value="chapterNav" aria-label="chapters">
            <Tooltip title="Show/Hide Chapters" placement="bottom">
              <MenuBookIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="aiPane" aria-label="ai assistant">
            <Tooltip title="Show/Hide AI Assistant" placement="bottom">
              <SmartToyIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="collaboration" aria-label="collaborators">
            <Tooltip title="Show/Hide Collaborators" placement="bottom">
              <GroupIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="versionHistory" aria-label="version history">
            <Tooltip title="Show/Hide Version History" placement="bottom">
              <HistoryIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
      )}

      <Tooltip title={focusModeActive ? "Exit Focus Mode" : "Enter Focus Mode"} placement="bottom">
        <IconButton
          onClick={onToggleFocusMode}
          size="small"
          sx={{
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
          }}
        >
          {focusModeActive ? (
            <FullscreenExitIcon fontSize="small" />
          ) : (
            <CenterFocusStrongIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default FocusModeControls;
