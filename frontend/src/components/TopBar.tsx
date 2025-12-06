/**
 * TopBar: Logo, Project Title, Export/Save Buttons.
 */
import React from "react";
import { AppBar, Toolbar, Typography, Button, Box } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

interface TopBarProps {
  projectTitle: string;
  onSave?: () => void;
  onExport?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ projectTitle, onSave, onExport }) => {
  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          📖 Book Generation
        </Typography>
        <Typography variant="subtitle1" sx={{ mx: 2 }}>
          {projectTitle}
        </Typography>
        <Box>
          <Button startIcon={<SaveIcon />} onClick={onSave} sx={{ mr: 1 }}>
            Save
          </Button>
          <Button startIcon={<FileDownloadIcon />} onClick={onExport}>
            Export
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;
