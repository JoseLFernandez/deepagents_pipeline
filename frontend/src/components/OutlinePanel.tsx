import React from "react";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Button,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import VisibilityIcon from "@mui/icons-material/Visibility";

export interface OutlineItem {
  id: string;
  text: string;
  level: number;
  pos: number;
  nodeSize: number;
}

interface OutlinePanelProps {
  items: OutlineItem[];
  onFocus: (item: OutlineItem) => void;
  onAddSibling: (item: OutlineItem) => void;
  onAddChild: (item: OutlineItem) => void;
  onAddParagraphAfter: (item: OutlineItem) => void;
  onRunAIOutline?: (item: OutlineItem) => void;
  onAddTopLevel: () => void;
}

const OutlinePanel: React.FC<OutlinePanelProps> = ({
  items,
  onFocus,
  onAddSibling,
  onAddChild,
  onAddParagraphAfter,
  onRunAIOutline,
  onAddTopLevel,
}) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        width: 260,
        flexShrink: 0,
        borderLeft: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 1.5 }}>
        <Typography variant="subtitle2" fontWeight="bold">
          Outline
        </Typography>
        <Tooltip title="Add new chapter heading">
          <Button
            size="small"
            startIcon={<AddIcon fontSize="small" />}
            onClick={onAddTopLevel}
            sx={{ textTransform: "none" }}
          >
            Section
          </Button>
        </Tooltip>
      </Box>
      <Divider />
      <Box sx={{ flex: 1, overflowY: "auto" }}>
        {items.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Start typing a heading to see it here, or add a new one.
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {items.map((item) => (
              <ListItem key={item.id} disablePadding sx={{ alignItems: "stretch" }}>
                <ListItemButton
                  onClick={() => onFocus(item)}
                  sx={{
                    alignItems: "flex-start",
                    py: 1,
                    pl: 1.5 + (item.level - 1) * 1.5,
                    pr: 1,
                    gap: 1,
                    transition: "background-color 0.2s",
                    "&:hover .outline-controls": { opacity: 1 },
                  }}
                >
                  <ListItemText
                    primaryTypographyProps={{
                      variant: "body2",
                      sx: {
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        fontWeight: item.level === 1 ? 600 : 400,
                      },
                    }}
                    primary={item.text || "(Untitled heading)"}
                  />
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 0.5,
                      opacity: 0,
                      transition: "opacity 0.2s",
                    }}
                    className="outline-controls"
                  >
                    <Tooltip title="Focus heading">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); onFocus(item); }}>
                        <VisibilityIcon fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Add subsection">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); onAddChild(item); }}>
                        <AddIcon fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Add paragraph after">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); onAddParagraphAfter(item); }}>
                        <span style={{ fontWeight: 600, fontSize: "0.75rem" }}>¶</span>
                      </IconButton>
                    </Tooltip>
                    {onRunAIOutline && (
                      <Tooltip title="Ask AI for outline refinements">
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onRunAIOutline(item); }}>
                          <AutoFixHighIcon fontSize="inherit" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Add sibling heading">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); onAddSibling(item); }}>
                        <AddIcon fontSize="inherit" style={{ transform: "rotate(90deg)" }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
};

export default OutlinePanel;
