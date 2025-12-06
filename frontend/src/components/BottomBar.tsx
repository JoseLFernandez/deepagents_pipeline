/**
 * BottomBar: Fixed at bottom with Export (PDF/DOCX), Collaboration, and AI Mode controls.
 */
import React from "react";
import {
  AppBar,
  Toolbar,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  Box,
  Tooltip,
  Divider,
  useTheme,
} from "@mui/material";
import GroupIcon from "@mui/icons-material/Group";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DescriptionIcon from "@mui/icons-material/Description";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import SummarizeIcon from "@mui/icons-material/Summarize";
import { AIMode } from "../state/aiStore";

interface BottomBarProps {
  aiMode: AIMode;
  onAIModeChange: (mode: AIMode) => void;
  onExportPDF?: () => void;
  onExportDOCX?: () => void;
  onCollaborate?: () => void;
}

const BottomBar: React.FC<BottomBarProps> = ({
  aiMode,
  onAIModeChange,
  onExportPDF,
  onExportDOCX,
  onCollaborate,
}) => {
  const theme = useTheme();

  return (
    <AppBar
      position="fixed"
      color="default"
      sx={{
        top: "auto",
        bottom: 0,
        borderTop: `1px solid ${theme.palette.divider}`,
      }}
      elevation={0}
    >
      <Toolbar variant="dense" sx={{ justifyContent: "space-between" }}>
        {/* Export Controls */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Tooltip title="Export as PDF">
            <Button
              startIcon={<PictureAsPdfIcon />}
              onClick={onExportPDF}
              size="small"
              sx={{ textTransform: "none" }}
            >
              PDF
            </Button>
          </Tooltip>
          <Tooltip title="Export as DOCX">
            <Button
              startIcon={<DescriptionIcon />}
              onClick={onExportDOCX}
              size="small"
              sx={{ textTransform: "none" }}
            >
              DOCX
            </Button>
          </Tooltip>
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          <Tooltip title="Invite collaborators">
            <Button
              startIcon={<GroupIcon />}
              onClick={onCollaborate}
              size="small"
              sx={{ textTransform: "none" }}
            >
              Collaborate
            </Button>
          </Tooltip>
        </Box>

        {/* AI Mode Toggle */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            component="span"
            sx={{ fontSize: "0.75rem", color: theme.palette.text.secondary, mr: 1 }}
          >
            AI Mode:
          </Box>
          <ToggleButtonGroup
            value={aiMode}
            exclusive
            onChange={(_, value) => value && onAIModeChange(value as AIMode)}
            size="small"
            sx={{
              "& .MuiToggleButton-root": {
                textTransform: "none",
                px: 1.5,
              },
            }}
          >
            <ToggleButton value="creative">
              <Tooltip title="Creative writing mode">
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <AutoFixHighIcon fontSize="small" />
                  Creative
                </Box>
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="factual">
              <Tooltip title="Factual, research-focused mode">
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <FactCheckIcon fontSize="small" />
                  Factual
                </Box>
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="summarize">
              <Tooltip title="Summarization mode">
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <SummarizeIcon fontSize="small" />
                  Summarize
                </Box>
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default BottomBar;
