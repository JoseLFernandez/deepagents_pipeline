/**
 * VersionHistoryPanel: Collapsible panel showing version history with restore capability.
 */
import React, { useState } from "react";
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  Collapse,
  Chip,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
} from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import RestoreIcon from "@mui/icons-material/Restore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PersonIcon from "@mui/icons-material/Person";
import AutoSaveIcon from "@mui/icons-material/CloudDone";
import CompareIcon from "@mui/icons-material/Compare";

export interface VersionEntry {
  id: string;
  timestamp: string;
  author: string;
  chapterId: number;
  chapterTitle: string;
  content: string;
  type: "auto" | "manual" | "collaboration";
  label?: string;
}

interface VersionHistoryPanelProps {
  versions: VersionEntry[];
  onRestore: (version: VersionEntry) => void;
  onCompare?: (version: VersionEntry) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
  versions,
  onRestore,
  onCompare,
  collapsed = false,
  onToggleCollapse,
}) => {
  const theme = useTheme();
  const [selectedVersion, setSelectedVersion] = useState<VersionEntry | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());

  // Group versions by chapter
  const versionsByChapter = versions.reduce((acc, v) => {
    if (!acc[v.chapterId]) acc[v.chapterId] = [];
    acc[v.chapterId].push(v);
    return acc;
  }, {} as Record<number, VersionEntry[]>);

  const toggleChapter = (chapterId: number) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  const handleRestoreClick = (version: VersionEntry) => {
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

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getTypeIcon = (type: VersionEntry["type"]) => {
    switch (type) {
      case "auto":
        return <AutoSaveIcon fontSize="small" color="action" />;
      case "collaboration":
        return <PersonIcon fontSize="small" color="primary" />;
      default:
        return <HistoryIcon fontSize="small" color="action" />;
    }
  };

  const getTypeColor = (type: VersionEntry["type"]) => {
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
    return (
      <Tooltip title="Version History" placement="left">
        <IconButton
          onClick={onToggleCollapse}
          sx={{
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
          }}
        >
          <HistoryIcon />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <>
      <Box
        sx={{
          width: 240,
          minWidth: 200,
          flexShrink: 0,
          height: "100%",
          borderLeft: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            p: 1.5,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <HistoryIcon fontSize="small" />
            <Typography variant="subtitle2" fontWeight="bold">
              Version History
            </Typography>
          </Box>
          <IconButton size="small" onClick={onToggleCollapse}>
            <ExpandMoreIcon sx={{ transform: "rotate(90deg)" }} />
          </IconButton>
        </Box>

        {/* Version List */}
        <Box sx={{ flex: 1, overflowY: "auto" }}>
          {Object.entries(versionsByChapter).length === 0 ? (
            <Box sx={{ p: 2, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                No versions yet. Changes will be saved automatically.
              </Typography>
            </Box>
          ) : (
            Object.entries(versionsByChapter).map(([chapterId, chapterVersions]) => (
              <Box key={chapterId}>
                <ListItemButton
                  onClick={() => toggleChapter(Number(chapterId))}
                  sx={{ py: 0.5 }}
                >
                  <ListItemText
                    primary={chapterVersions[0]?.chapterTitle || `Chapter ${chapterId}`}
                    primaryTypographyProps={{ variant: "body2", fontWeight: "medium" }}
                    secondary={`${chapterVersions.length} versions`}
                    secondaryTypographyProps={{ variant: "caption" }}
                  />
                  {expandedChapters.has(Number(chapterId)) ? (
                    <ExpandLessIcon fontSize="small" />
                  ) : (
                    <ExpandMoreIcon fontSize="small" />
                  )}
                </ListItemButton>
                <Collapse in={expandedChapters.has(Number(chapterId))}>
                  <List dense disablePadding sx={{ pl: 2 }}>
                    {chapterVersions.slice(0, 10).map((version) => (
                      <ListItemButton
                        key={version.id}
                        sx={{
                          py: 0.5,
                          borderRadius: 1,
                          mx: 0.5,
                          "&:hover .version-actions": {
                            opacity: 1,
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          {getTypeIcon(version.type)}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                              <Typography variant="caption">
                                {formatTime(version.timestamp)}
                              </Typography>
                              {version.label && (
                                <Chip
                                  label={version.label}
                                  size="small"
                                  color={getTypeColor(version.type)}
                                  sx={{ height: 16, fontSize: "0.65rem" }}
                                />
                              )}
                            </Box>
                          }
                          secondary={version.author}
                          secondaryTypographyProps={{ variant: "caption" }}
                        />
                        <Box
                          className="version-actions"
                          sx={{
                            opacity: 0,
                            transition: "opacity 0.2s",
                            display: "flex",
                            gap: 0.5,
                          }}
                        >
                          {onCompare && (
                            <Tooltip title="Compare">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCompare(version);
                                }}
                              >
                                <CompareIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Restore">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRestoreClick(version);
                              }}
                            >
                              <RestoreIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
                <Divider />
              </Box>
            ))
          )}
        </Box>
      </Box>

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreDialogOpen} onClose={() => setRestoreDialogOpen(false)}>
        <DialogTitle>Restore Version?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This will replace the current content of "{selectedVersion?.chapterTitle}" with
            the version from {selectedVersion && formatTime(selectedVersion.timestamp)}.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            A backup of your current content will be saved automatically.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmRestore} variant="contained" color="primary">
            Restore
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default VersionHistoryPanel;
