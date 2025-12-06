/**
 * MainLayout: Split-pane container using MUI Box with flex for BookPane and AIPane.
 * Saves user preferences (pane width) to localStorage.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Box, IconButton, useTheme } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

const STORAGE_KEY = "deepagents_split_pane_width";

interface MainLayoutProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftWidth?: number; // percentage
}

const MainLayout: React.FC<MainLayoutProps> = ({
  left,
  right,
  defaultLeftWidth = 60,
}) => {
  const theme = useTheme();
  
  // Load saved width from localStorage or use default
  const [leftWidth, setLeftWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
          return parsed;
        }
      }
    }
    return defaultLeftWidth;
  });
  
  const [isDragging, setIsDragging] = useState(false);

  // Save width to localStorage when it changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, leftWidth.toString());
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [leftWidth]);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
    setLeftWidth(Math.max(20, Math.min(80, newWidth)));
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const toggleCollapse = useCallback((side: "left" | "right") => {
    if (side === "left") {
      setLeftWidth((prev) => (prev < 30 ? 60 : 0));
    } else {
      setLeftWidth((prev) => (prev > 70 ? 60 : 100));
    }
  }, []);

  // If no left content, show only right pane
  const showLeftPane = left !== null && leftWidth > 0;
  const showRightPane = right !== null;

  // If only one pane has content, show it full width
  if (!showLeftPane && showRightPane) {
    return (
      <Box sx={{ display: "flex", height: "100%", width: "100%", overflow: "hidden" }}>
        {right}
      </Box>
    );
  }

  if (showLeftPane && !showRightPane) {
    return (
      <Box sx={{ display: "flex", height: "100%", width: "100%", overflow: "hidden" }}>
        {left}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        userSelect: isDragging ? "none" : "auto",
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Left Pane (BookPane) */}
      <Box
        sx={{
          width: `${leftWidth}%`,
          minWidth: 200,
          overflow: "hidden",
          transition: isDragging ? "none" : "width 0.2s ease",
          borderRight: `1px solid ${theme.palette.divider}`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {left}
      </Box>

      {/* Resizer / Divider */}
      <Box
        sx={{
          width: 8,
          cursor: "col-resize",
          backgroundColor: isDragging
            ? theme.palette.primary.light
            : theme.palette.divider,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.5,
          "&:hover": {
            backgroundColor: theme.palette.action.hover,
          },
          transition: "background-color 0.2s",
        }}
        onMouseDown={handleMouseDown}
      >
        <IconButton
          size="small"
          onClick={() => toggleCollapse("left")}
          sx={{ p: 0.25 }}
        >
          {leftWidth < 30 ? (
            <ChevronRightIcon fontSize="small" />
          ) : (
            <ChevronLeftIcon fontSize="small" />
          )}
        </IconButton>
        <Box
          sx={{
            width: 4,
            height: 40,
            borderRadius: 2,
            backgroundColor: theme.palette.grey[400],
          }}
        />
        <IconButton
          size="small"
          onClick={() => toggleCollapse("right")}
          sx={{ p: 0.25 }}
        >
          {leftWidth > 70 ? (
            <ChevronLeftIcon fontSize="small" />
          ) : (
            <ChevronRightIcon fontSize="small" />
          )}
        </IconButton>
      </Box>

      {/* Right Pane (AIPane) */}
      <Box
        sx={{
          flex: 1,
          width: 0,
          minWidth: 200,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {right}
      </Box>
    </Box>
  );
};

export default MainLayout;
