/**
 * AIPane: AIChatWindow + SuggestionCards with Insert/Save actions.
 */
import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Avatar,
  Paper,
  Chip,
  Divider,
  CircularProgress,
  useTheme,
  Fade,
  Tooltip,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import AddIcon from "@mui/icons-material/Add";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import CloseIcon from "@mui/icons-material/Close";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ImageIcon from "@mui/icons-material/Image";
import SearchIcon from "@mui/icons-material/Search";
import { ChatMessage, AISuggestion } from "../state";

interface AIPaneProps {
  messages: ChatMessage[];
  suggestions: AISuggestion[];
  loading: boolean;
  onSendMessage: (text: string) => void;
  onInsertSuggestion: (suggestion: AISuggestion) => void;
  onDismissSuggestion: (suggestionId: string) => void;
  onSaveSuggestion?: (suggestion: AISuggestion) => void;
  onGenerateImage?: (prompt: string) => void;
  onSearchWeb?: (query: string) => void;
}

// Chat message bubble component
const ChatBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const theme = useTheme();
  const isUser = message.role === "user";

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        mb: 2,
        gap: 1,
      }}
    >
      {!isUser && (
        <Avatar sx={{ bgcolor: theme.palette.secondary.main, width: 32, height: 32 }}>
          <SmartToyIcon fontSize="small" />
        </Avatar>
      )}
      <Paper
        elevation={1}
        sx={{
          px: 2,
          py: 1.5,
          maxWidth: "80%",
          backgroundColor: isUser
            ? theme.palette.primary.main
            : theme.palette.mode === "dark"
            ? theme.palette.grey[800]
            : theme.palette.grey[100],
          color: isUser ? theme.palette.primary.contrastText : theme.palette.text.primary,
          borderRadius: 2,
          borderTopLeftRadius: isUser ? 16 : 4,
          borderTopRightRadius: isUser ? 4 : 16,
        }}
      >
        <Typography
          variant="body2"
          sx={{ whiteSpace: "pre-wrap" }}
          dangerouslySetInnerHTML={{ __html: message.text }}
        />
        <Typography
          variant="caption"
          sx={{
            display: "block",
            mt: 0.5,
            opacity: 0.7,
            textAlign: isUser ? "right" : "left",
          }}
        >
          {new Date(message.timestamp).toLocaleTimeString()}
        </Typography>
      </Paper>
      {isUser && (
        <Avatar sx={{ bgcolor: theme.palette.primary.dark, width: 32, height: 32 }}>
          <PersonIcon fontSize="small" />
        </Avatar>
      )}
    </Box>
  );
};

// Suggestion card component
const SuggestionCard: React.FC<{
  suggestion: AISuggestion;
  onInsert: () => void;
  onDismiss: () => void;
  onSave?: () => void;
}> = ({ suggestion, onInsert, onDismiss, onSave }) => {
  const theme = useTheme();

  const typeColors: Record<string, string> = {
    rewrite: theme.palette.info.main,
    expand: theme.palette.success.main,
    expansion: theme.palette.success.main,
    summarize: theme.palette.warning.main,
    summary: theme.palette.warning.main,
    critique: theme.palette.error.main,
    generation: theme.palette.primary.main,
    reflection: theme.palette.warning.dark,
    editor: theme.palette.success.dark,
    image: theme.palette.secondary.main,
    other: theme.palette.grey[600],
  };

  const label = suggestion.stage
    ? `${suggestion.stage.toUpperCase()}${
        typeof suggestion.stageOrder === "number" ? ` · Step ${suggestion.stageOrder + 1}` : ""
      }`
    : suggestion.type.toUpperCase();

  const colorKey = suggestion.stage ?? suggestion.type;

  return (
    <Card
      sx={{
        mb: 1.5,
        borderLeft: `4px solid ${typeColors[colorKey] || theme.palette.grey[500]}`,
        "&:hover": {
          boxShadow: 3,
        },
        transition: "box-shadow 0.2s",
      }}
    >
      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <AutoAwesomeIcon fontSize="small" color="action" />
          <Chip
            label={label}
            size="small"
            sx={{
              backgroundColor: typeColors[colorKey] || theme.palette.grey[500],
              color: "#fff",
              fontWeight: "bold",
              fontSize: "0.65rem",
            }}
          />
        </Box>
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
          {suggestion.text}
        </Typography>
        {suggestion.notes && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            {suggestion.notes}
          </Typography>
        )}
      </CardContent>
      <CardActions sx={{ pt: 0, px: 2, pb: 1.5 }}>
        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onInsert}
          sx={{ textTransform: "none" }}
        >
          Insert
        </Button>
        {onSave && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<BookmarkIcon />}
            onClick={onSave}
            sx={{ textTransform: "none" }}
          >
            Save
          </Button>
        )}
        <IconButton size="small" onClick={onDismiss} sx={{ ml: "auto" }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </CardActions>
    </Card>
  );
};

const AIPane: React.FC<AIPaneProps> = ({
  messages,
  suggestions,
  loading,
  onSendMessage,
  onInsertSuggestion,
  onDismissSuggestion,
  onSaveSuggestion,
  onGenerateImage,
  onSearchWeb,
}) => {
  const theme = useTheme();
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  const handleGenerateImage = () => {
    if (input.trim() && onGenerateImage) {
      onGenerateImage(input.trim());
      setInput("");
    }
  };

  const handleSearchWeb = () => {
    if (input.trim() && onSearchWeb) {
      onSearchWeb(input.trim());
      setInput("");
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", minHeight: 0, overflow: "hidden" }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          p: 1.5,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <SmartToyIcon color="primary" />
        <Typography variant="h6" sx={{ flex: 1 }}>AI Assistant</Typography>
        {/* Action buttons in header */}
        {onSearchWeb && (
          <Tooltip title="Search web with Perplexity AI">
            <IconButton
              size="small"
              onClick={handleSearchWeb}
              disabled={loading || !input.trim()}
              color="primary"
            >
              <SearchIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {onGenerateImage && (
          <Tooltip title="Generate image with Picsart AI">
            <IconButton
              size="small"
              onClick={handleGenerateImage}
              disabled={loading || !input.trim()}
              color="primary"
            >
              <ImageIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* AIChatWindow */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          p: 2,
          backgroundColor:
            theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[50],
        }}
      >
        {messages.length === 0 && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              opacity: 0.6,
            }}
          >
            <SmartToyIcon sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Ask me to rewrite, expand, summarize, or critique your text.
            </Typography>
          </Box>
        )}
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
        {loading && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: 5 }}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              Thinking...
            </Typography>
          </Box>
        )}
        <div ref={chatEndRef} />
      </Box>

      {/* Chat Input */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
          p: 1.5,
          borderTop: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <TextField
          sx={{ flex: 1, minWidth: 150 }}
          size="small"
          placeholder="Ask AI, search the web, or describe an image to generate..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={loading}
          multiline
          maxRows={3}
        />
        <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
          {onSearchWeb && (
            <Tooltip title="Search web with Perplexity AI">
              <span>
                <Button
                  variant="outlined"
                  onClick={handleSearchWeb}
                  disabled={loading || !input.trim()}
                  sx={{ minWidth: 40, px: 1 }}
                >
                  <SearchIcon />
                </Button>
              </span>
            </Tooltip>
          )}
          {onGenerateImage && (
            <Tooltip title="Generate image with Picsart AI">
              <span>
                <Button
                  variant="outlined"
                  onClick={handleGenerateImage}
                  disabled={loading || !input.trim()}
                  sx={{ minWidth: 40, px: 1 }}
                >
                  <ImageIcon />
                </Button>
              </span>
            </Tooltip>
          )}
          <Button
            variant="contained"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            sx={{ minWidth: 40, px: 1.5 }}
          >
            <SendIcon />
          </Button>
        </Box>
      </Box>

      {/* Suggestions Section */}
      {suggestions.length > 0 && (
        <>
          <Divider />
          <Box
            sx={{
              p: 1.5,
              maxHeight: 250,
              overflowY: "auto",
              backgroundColor: theme.palette.background.paper,
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: "bold" }}>
              Suggestions ({suggestions.length})
            </Typography>
            {suggestions.map((s) => (
              <Fade in key={s.id}>
                <div>
                  <SuggestionCard
                    suggestion={s}
                    onInsert={() => onInsertSuggestion(s)}
                    onDismiss={() => onDismissSuggestion(s.id)}
                    onSave={onSaveSuggestion ? () => onSaveSuggestion(s) : undefined}
                  />
                </div>
              </Fade>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
};

export default AIPane;
