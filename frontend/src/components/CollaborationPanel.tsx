/**
 * CollaborationPanel: Real-time collaboration features with presence, cursors, and chat.
 */
import React, { useState } from "react";
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton,
  Tooltip,
  TextField,
  Badge,
  Chip,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  Fade,
} from "@mui/material";
import GroupIcon from "@mui/icons-material/Group";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import ChatIcon from "@mui/icons-material/Chat";
import SendIcon from "@mui/icons-material/Send";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import CircleIcon from "@mui/icons-material/Circle";

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  color: string;
  status: "online" | "away" | "offline";
  currentChapter?: number;
  cursorPosition?: { line: number; column: number };
}

export interface CollabMessage {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  timestamp: string;
}

interface CollaborationPanelProps {
  collaborators: Collaborator[];
  messages: CollabMessage[];
  currentUserId: string;
  sessionId?: string;
  onInvite: (email: string) => void;
  onSendMessage: (text: string) => void;
  onJumpToCollaborator?: (collaborator: Collaborator) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const CollaborationPanel: React.FC<CollaborationPanelProps> = ({
  collaborators,
  messages,
  currentUserId,
  sessionId,
  onInvite,
  onSendMessage,
  onJumpToCollaborator,
  collapsed = false,
  onToggleCollapse,
}) => {
  const theme = useTheme();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [showChat, setShowChat] = useState(true);

  const onlineCount = collaborators.filter((c) => c.status === "online").length;

  const handleInvite = () => {
    if (inviteEmail.trim()) {
      onInvite(inviteEmail.trim());
      setInviteEmail("");
      setInviteDialogOpen(false);
    }
  };

  const handleSendMessage = () => {
    if (chatInput.trim()) {
      onSendMessage(chatInput.trim());
      setChatInput("");
    }
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/collab/${sessionId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusColor = (status: Collaborator["status"]) => {
    switch (status) {
      case "online":
        return theme.palette.success.main;
      case "away":
        return theme.palette.warning.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (collapsed) {
    return (
      <Tooltip title={`Collaborators (${onlineCount} online)`} placement="right">
        <IconButton
          onClick={onToggleCollapse}
          sx={{
            position: "fixed",
            left: 8,
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
          <Badge badgeContent={onlineCount} color="success">
            <GroupIcon />
          </Badge>
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
          borderRight: `1px solid ${theme.palette.divider}`,
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
            <GroupIcon fontSize="small" />
            <Typography variant="subtitle2" fontWeight="bold">
              Collaborators
            </Typography>
            <Chip
              label={`${onlineCount} online`}
              size="small"
              color="success"
              sx={{ height: 20, fontSize: "0.7rem" }}
            />
          </Box>
          <Box>
            <Tooltip title="Invite">
              <IconButton size="small" onClick={() => setInviteDialogOpen(true)}>
                <PersonAddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={onToggleCollapse}>
              <ExpandMoreIcon sx={{ transform: "rotate(-90deg)" }} />
            </IconButton>
          </Box>
        </Box>

        {/* Session Link */}
        {sessionId && (
          <Box
            sx={{
              p: 1,
              backgroundColor: theme.palette.action.hover,
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Typography variant="caption" sx={{ flex: 1 }} noWrap>
              Session: {sessionId.slice(0, 8)}...
            </Typography>
            <Tooltip title={copied ? "Copied!" : "Copy invite link"}>
              <IconButton size="small" onClick={handleCopyLink}>
                {copied ? (
                  <CheckIcon fontSize="small" color="success" />
                ) : (
                  <ContentCopyIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          </Box>
        )}

        {/* Collaborator List */}
        <List dense sx={{ flex: showChat ? "0 0 auto" : 1, overflowY: "auto", maxHeight: showChat ? 200 : "none" }}>
          {collaborators.map((collaborator) => (
            <ListItem
              key={collaborator.id}
              secondaryAction={
                collaborator.id !== currentUserId && onJumpToCollaborator && (
                  <Tooltip title="Jump to their location">
                    <IconButton
                      size="small"
                      onClick={() => onJumpToCollaborator(collaborator)}
                    >
                      <CircleIcon
                        sx={{ fontSize: 12, color: collaborator.color }}
                      />
                    </IconButton>
                  </Tooltip>
                )
              }
              sx={{
                "&:hover": {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <ListItemAvatar sx={{ minWidth: 40 }}>
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                  badgeContent={
                    <CircleIcon
                      sx={{
                        fontSize: 10,
                        color: getStatusColor(collaborator.status),
                        backgroundColor: theme.palette.background.paper,
                        borderRadius: "50%",
                      }}
                    />
                  }
                >
                  <Avatar
                    src={collaborator.avatar}
                    sx={{
                      width: 32,
                      height: 32,
                      fontSize: "0.875rem",
                      backgroundColor: collaborator.color,
                    }}
                  >
                    {collaborator.name[0].toUpperCase()}
                  </Avatar>
                </Badge>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Typography variant="body2" noWrap>
                      {collaborator.name}
                    </Typography>
                    {collaborator.id === currentUserId && (
                      <Chip
                        label="You"
                        size="small"
                        sx={{ height: 16, fontSize: "0.6rem" }}
                      />
                    )}
                  </Box>
                }
                secondary={
                  collaborator.currentChapter
                    ? `Editing Chapter ${collaborator.currentChapter}`
                    : collaborator.status
                }
                secondaryTypographyProps={{ variant: "caption" }}
              />
            </ListItem>
          ))}
        </List>

        <Divider />

        {/* Chat Toggle */}
        <ListItemButton
          onClick={() => setShowChat(!showChat)}
          sx={{ py: 0.5 }}
        >
          <ListItemAvatar sx={{ minWidth: 32 }}>
            <ChatIcon fontSize="small" />
          </ListItemAvatar>
          <ListItemText
            primary="Team Chat"
            primaryTypographyProps={{ variant: "body2" }}
          />
          <ExpandMoreIcon
            sx={{
              transform: showChat ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }}
          />
        </ListItemButton>

        {/* Chat Section */}
        <Fade in={showChat}>
          <Box
            sx={{
              flex: 1,
              display: showChat ? "flex" : "none",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            {/* Messages */}
            <Box
              sx={{
                flex: 1,
                overflowY: "auto",
                p: 1,
                backgroundColor:
                  theme.palette.mode === "dark"
                    ? theme.palette.grey[900]
                    : theme.palette.grey[50],
              }}
            >
              {messages.length === 0 ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", textAlign: "center", mt: 2 }}
                >
                  No messages yet. Start the conversation!
                </Typography>
              ) : (
                messages.map((msg) => (
                  <Box
                    key={msg.id}
                    sx={{
                      mb: 1,
                      p: 1,
                      backgroundColor: theme.palette.background.paper,
                      borderRadius: 1,
                      borderLeft: `3px solid ${
                        collaborators.find((c) => c.id === msg.authorId)?.color ||
                        theme.palette.grey[500]
                      }`,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        mb: 0.5,
                      }}
                    >
                      <Typography variant="caption" fontWeight="bold">
                        {msg.authorName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(msg.timestamp)}
                      </Typography>
                    </Box>
                    <Typography variant="body2">{msg.text}</Typography>
                  </Box>
                ))
              )}
            </Box>

            {/* Chat Input */}
            <Box
              sx={{
                display: "flex",
                gap: 0.5,
                p: 1,
                borderTop: `1px solid ${theme.palette.divider}`,
              }}
            >
              <TextField
                size="small"
                placeholder="Message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                fullWidth
                sx={{ "& .MuiInputBase-input": { fontSize: "0.875rem" } }}
              />
              <IconButton
                size="small"
                onClick={handleSendMessage}
                disabled={!chatInput.trim()}
                color="primary"
              >
                <SendIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        </Fade>
      </Box>

      {/* Invite Dialog */}
      <Dialog
        open={inviteDialogOpen}
        onClose={() => setInviteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Invite Collaborator</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Email address"
            type="email"
            fullWidth
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@example.com"
            sx={{ mt: 1 }}
          />
          {sessionId && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Or share this link:
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  p: 1,
                  backgroundColor: theme.palette.action.hover,
                  borderRadius: 1,
                }}
              >
                <Typography variant="caption" sx={{ flex: 1 }} noWrap>
                  {`${window.location.origin}/collab/${sessionId}`}
                </Typography>
                <IconButton size="small" onClick={handleCopyLink}>
                  {copied ? (
                    <CheckIcon fontSize="small" color="success" />
                  ) : (
                    <ContentCopyIcon fontSize="small" />
                  )}
                </IconButton>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleInvite}
            variant="contained"
            disabled={!inviteEmail.trim()}
          >
            Send Invite
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CollaborationPanel;
