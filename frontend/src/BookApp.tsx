/**
 * BookApp: Main entry point for the Book Generation Frontend.
 * Integrates TopBar, BottomBar, MainLayout, BookPane, AIPane, CollaborationPanel, VersionHistoryPanel.
 * Supports Focus Mode for distraction-free writing.
 */
import React, { useEffect, useCallback } from "react";
import { Box, CssBaseline, ThemeProvider, createTheme, Fade } from "@mui/material";
import {
  TopBar,
  BottomBar,
  MainLayout,
  BookPane,
  AIPane,
  CollaborationPanel,
  VersionHistoryPanel,
  FocusModeControls,
  VersionEntry,
  Collaborator,
  PanelVisibility,
} from "./components";
import { useBookStore, useAIStore, useUIStore, useCollaborationStore, AISuggestion } from "./state";
import { sendChatMessage, handleSuggestionRequest, saveBook, exportBook, generateImage, searchWeb } from "./middleware";

const lightTheme = createTheme({ palette: { mode: "light" } });
const darkTheme = createTheme({ palette: { mode: "dark" } });

const BookApp: React.FC = () => {
  // Book state
  const chapters = useBookStore((s) => s.chapters);
  const activeChapterId = useBookStore((s) => s.activeChapterId);
  const setChapters = useBookStore((s) => s.setChapters);
  const setActiveChapter = useBookStore((s) => s.setActiveChapter);
  const updateChapterContent = useBookStore((s) => s.updateChapterContent);
  const addChapter = useBookStore((s) => s.addChapter);

  // AI state
  const messages = useAIStore((s) => s.messages);
  const suggestions = useAIStore((s) => s.suggestions);
  const aiMode = useAIStore((s) => s.mode);
  const aiLoading = useAIStore((s) => s.loading);
  const addMessage = useAIStore((s) => s.addMessage);
  const addSuggestion = useAIStore((s) => s.addSuggestion);
  const removeSuggestion = useAIStore((s) => s.removeSuggestion);
  const setAIMode = useAIStore((s) => s.setMode);
  const setAILoading = useAIStore((s) => s.setLoading);

  // UI state
  const theme = useUIStore((s) => s.theme);
  const setStatusMessage = useUIStore((s) => s.setStatusMessage);

  // Collaboration state
  const sessionId = useCollaborationStore((s) => s.sessionId);
  const currentUserId = useCollaborationStore((s) => s.currentUserId);
  const collaborators = useCollaborationStore((s) => s.collaborators);
  const collabMessages = useCollaborationStore((s) => s.messages);
  const versions = useCollaborationStore((s) => s.versions);
  const focusModeActive = useCollaborationStore((s) => s.focusModeActive);
  const panelVisibility = useCollaborationStore((s) => s.panelVisibility);
  const setSessionId = useCollaborationStore((s) => s.setSessionId);
  const addCollaborator = useCollaborationStore((s) => s.addCollaborator);
  const addCollabMessage = useCollaborationStore((s) => s.addMessage);
  const addVersion = useCollaborationStore((s) => s.addVersion);
  const toggleFocusMode = useCollaborationStore((s) => s.toggleFocusMode);
  const togglePanel = useCollaborationStore((s) => s.togglePanel);
  const updateCollaborator = useCollaborationStore((s) => s.updateCollaborator);

  // Initialize with sample data (for demo)
  useEffect(() => {
    if (chapters.length === 0) {
      setChapters([
        { id: 1, title: "Chapter 1: Introduction", content: "<p>Welcome to your book...</p>" },
        { id: 2, title: "Chapter 2: The Journey Begins", content: "<p>Once upon a time...</p>" },
        { id: 3, title: "Chapter 3: Challenges", content: "<p>The hero faced many trials...</p>" },
      ]);
      setActiveChapter(1);
    }
    
    // Initialize collaboration session
    if (!sessionId) {
      setSessionId(`session-${Date.now().toString(36)}`);
    }
    
    // Add current user as collaborator
    if (collaborators.length === 0) {
      addCollaborator({
        id: currentUserId,
        name: "You",
        email: "you@example.com",
        color: "#2196F3",
        status: "online",
        currentChapter: 1,
      });
    }
  }, [chapters.length, setChapters, setActiveChapter, sessionId, setSessionId, collaborators.length, addCollaborator, currentUserId]);

  // Auto-save versions on content change
  const handleContentChangeWithVersion = useCallback((chapterId: number, content: string) => {
    const chapter = chapters.find((ch) => ch.id === chapterId);
    if (chapter) {
      // Save version every 30 seconds of editing (debounced in real implementation)
      const lastVersion = versions.find((v) => v.chapterId === chapterId);
      const shouldSaveVersion = !lastVersion || 
        (Date.now() - new Date(lastVersion.timestamp).getTime() > 30000);
      
      if (shouldSaveVersion && chapter.content !== content) {
        addVersion({
          id: `v-${Date.now()}`,
          timestamp: new Date().toISOString(),
          author: "You",
          chapterId,
          chapterTitle: chapter.title,
          content: chapter.content, // Save previous content
          type: "auto",
        });
      }
    }
    updateChapterContent(chapterId, content);
    
    // Update collaborator's current chapter
    updateCollaborator(currentUserId, { currentChapter: chapterId });
  }, [chapters, versions, addVersion, updateChapterContent, updateCollaborator, currentUserId]);

  // Handlers
  const handleSendMessage = async (text: string) => {
    const userMessage = {
      id: `${Date.now()}`,
      role: "user" as const,
      text,
      timestamp: new Date().toISOString(),
    };
    addMessage(userMessage);
    setAILoading(true);
    setStatusMessage("Sending message to AI...");

    try {
      // Get all messages from store + new user message for context
      const allMessages = [...messages, userMessage];
      
      // Build context from active chapter
      const activeChapter = activeChapterId != null 
        ? chapters.find((ch) => ch.id === activeChapterId)
        : null;
      const chapterContext = activeChapter 
        ? `Chapter: ${activeChapter.title}\n\nContent:\n${activeChapter.content?.slice(0, 1500) || ''}`
        : undefined;
      
      // Call AI backend via middleware
      const response = await sendChatMessage(allMessages, {
        context: chapterContext,
      });

      // Add assistant response
      addMessage({
        id: `${Date.now() + 1}`,
        role: "assistant",
        text: response,
        timestamp: new Date().toISOString(),
      });

      setStatusMessage("AI response received. Running agentic pipeline...");

      if (response) {
        try {
          await handleSuggestionRequest(
            `Based on the latest assistant response, provide a staged Generation → Reflection → Critique → Editor workflow that improves the chapter. Original prompt (truncated): ${text
              .slice(0, 160)
              .replace(/\s+/g, " ")}.`,
            "rewrite",
            {
              context: chapterContext,
              chapterId: activeChapter?.id,
            }
          );
          setStatusMessage("Agentic suggestions ready.");
        } catch (workflowError) {
          console.warn("Agentic workflow invocation failed:", workflowError);
          setStatusMessage("AI response received. Suggestions unavailable.");
        }
      } else {
        setStatusMessage("AI response received.");
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      setStatusMessage(`Error: ${errMsg}`);
      addMessage({
        id: `${Date.now() + 1}`,
        role: "assistant",
        text: `Sorry, I encountered an error: ${errMsg}`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setAILoading(false);
    }
  };

  const handleGenerateImage = async (prompt: string) => {
    addMessage({
      id: `${Date.now()}`,
      role: "user",
      text: `🖼️ Generate image: ${prompt}`,
      timestamp: new Date().toISOString(),
    });
    setAILoading(true);
    setStatusMessage("Generating image with Picsart AI...");

    try {
      const result = await generateImage(prompt);
      
      if (result.status === "success" && result.url) {
        // Add image as a message
        addMessage({
          id: `${Date.now() + 1}`,
          role: "assistant",
          text: `<p>Here's your generated image:</p><img src="${result.url}" alt="${prompt}" style="max-width: 100%; border-radius: 8px; margin-top: 8px;" /><p><small>Saved to: ${result.local_path}</small></p>`,
          timestamp: new Date().toISOString(),
        });
        
        // Also add as a suggestion so user can insert into chapter
        addSuggestion({
          id: `img-${Date.now()}`,
          type: "expand",
          text: `<figure><img src="${result.url}" alt="${prompt}" style="max-width: 100%;" /><figcaption>${prompt}</figcaption></figure>`,
          createdAt: new Date().toISOString(),
        });
        
        setStatusMessage("Image generated successfully!");
      } else {
        addMessage({
          id: `${Date.now() + 1}`,
          role: "assistant",
          text: `Sorry, image generation failed: ${result.message}`,
          timestamp: new Date().toISOString(),
        });
        setStatusMessage(`Image generation failed: ${result.message}`);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      setStatusMessage(`Error: ${errMsg}`);
      addMessage({
        id: `${Date.now() + 1}`,
        role: "assistant",
        text: `Sorry, image generation failed: ${errMsg}`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setAILoading(false);
    }
  };

  const handleSearchWeb = async (query: string) => {
    addMessage({
      id: `${Date.now()}`,
      role: "user",
      text: `🔍 Deep Search: ${query}`,
      timestamp: new Date().toISOString(),
    });
    setAILoading(true);
    setStatusMessage("Searching with DeepAgents (multi-source)...");

    try {
      const result = await searchWeb(query);
      
      if (result.status === "success" && result.summary) {
        // Build HTML showing the plan and results from each source
        let responseHtml = `<p><strong>🧠 Search Plan:</strong></p><ul>${result.plan.map((p) => `<li>${p}</li>`).join("")}</ul>`;
        responseHtml += `<p><strong>Tools Used:</strong> ${result.tools_used.join(", ")}</p><hr/>`;
        
        // Add results from each source
        for (const [sourceName, sourceData] of Object.entries(result.results)) {
          if (sourceData.status === "success" && sourceData.content) {
            responseHtml += `<p><strong>📚 ${sourceData.source}:</strong></p>`;
            responseHtml += `<p>${sourceData.content.substring(0, 800).replace(/\n/g, "</p><p>")}${sourceData.content.length > 800 ? "..." : ""}</p>`;
            
            // Add citations if available (from Perplexity)
            if (sourceData.citations?.length) {
              responseHtml += `<p><em>Sources: ${sourceData.citations.slice(0, 3).map((c) => `<a href="${c}" target="_blank">${new URL(c).hostname}</a>`).join(", ")}</em></p>`;
            }
            responseHtml += "<hr/>";
          }
        }
        
        // Show errors if any
        if (result.errors?.length) {
          responseHtml += `<p><em>⚠️ Some sources had errors: ${result.errors.join(", ")}</em></p>`;
        }
        
        // Add search result as a message
        addMessage({
          id: `${Date.now() + 1}`,
          role: "assistant",
          text: responseHtml,
          timestamp: new Date().toISOString(),
        });
        
        // Add summary as a suggestion so user can insert into chapter
        addSuggestion({
          id: `search-${Date.now()}`,
          type: "expand",
          text: result.summary,
          createdAt: new Date().toISOString(),
        });
        
        setStatusMessage(`Search completed! Used: ${result.tools_used.join(", ")}`);
      } else {
        addMessage({
          id: `${Date.now() + 1}`,
          role: "assistant",
          text: `Sorry, search returned no results.`,
          timestamp: new Date().toISOString(),
        });
        setStatusMessage(`Search returned no results`);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      setStatusMessage(`Error: ${errMsg}`);
      addMessage({
        id: `${Date.now() + 1}`,
        role: "assistant",
        text: `Sorry, deep search failed: ${errMsg}`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setAILoading(false);
    }
  };

  const handleInsertSuggestion = (suggestion: AISuggestion) => {
    if (activeChapterId != null) {
      const chapter = chapters.find((ch) => ch.id === activeChapterId);
      if (chapter) {
        updateChapterContent(activeChapterId, chapter.content + `<p>${suggestion.text}</p>`);
        setStatusMessage("Suggestion inserted into chapter.");
      }
      removeSuggestion(suggestion.id);
    }
  };

  const handleDismissSuggestion = (suggestionId: string) => {
    removeSuggestion(suggestionId);
  };

  const handleSave = async () => {
    setStatusMessage("Saving book...");
    try {
      const annotations = useBookStore.getState().annotations;
      const message = await saveBook(chapters, annotations);
      setStatusMessage(message || "Book saved successfully!");
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      setStatusMessage(`Save failed: ${errMsg}`);
    }
  };

  const handleExport = async () => {
    setStatusMessage("Exporting...");
    try {
      const url = await exportBook("pdf", chapters);
      setStatusMessage(`Export ready: ${url}`);
      // Optionally open the URL in a new tab
      if (url) window.open(url, "_blank");
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      setStatusMessage(`Export failed: ${errMsg}`);
    }
  };

  const handleExportPDF = async () => {
    setStatusMessage("Exporting PDF...");
    try {
      const url = await exportBook("pdf", chapters);
      setStatusMessage(`PDF ready: ${url}`);
      if (url) window.open(url, "_blank");
    } catch (error) {
      setStatusMessage(`PDF export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleExportDOCX = async () => {
    setStatusMessage("Exporting DOCX...");
    try {
      const url = await exportBook("docx", chapters);
      setStatusMessage(`DOCX ready: ${url}`);
      if (url) window.open(url, "_blank");
    } catch (error) {
      setStatusMessage(`DOCX export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleCollaborate = () => {
    togglePanel("collaboration");
    setStatusMessage("Collaboration panel toggled");
  };

  const handleAddChapter = () => {
    const newId = Math.max(0, ...chapters.map((c) => c.id)) + 1;
    addChapter({
      id: newId,
      title: `Chapter ${newId}: New Chapter`,
      content: "<p>Start writing...</p>",
    });
    setActiveChapter(newId);
    setStatusMessage(`Created Chapter ${newId}`);
    
    // Save version for the new chapter
    addVersion({
      id: `v-${Date.now()}`,
      timestamp: new Date().toISOString(),
      author: "You",
      chapterId: newId,
      chapterTitle: `Chapter ${newId}: New Chapter`,
      content: "<p>Start writing...</p>",
      type: "manual",
      label: "Created",
    });
  };

  // Collaboration handlers
  const handleInviteCollaborator = (email: string) => {
    setStatusMessage(`Invitation sent to ${email}`);
    // In real implementation, this would send an API request
  };

  const handleSendCollabMessage = (text: string) => {
    addCollabMessage({
      id: `msg-${Date.now()}`,
      authorId: currentUserId,
      authorName: "You",
      text,
      timestamp: new Date().toISOString(),
    });
  };

  const handleJumpToCollaborator = (collaborator: Collaborator) => {
    if (collaborator.currentChapter) {
      setActiveChapter(collaborator.currentChapter);
      setStatusMessage(`Jumped to ${collaborator.name}'s location`);
    }
  };

  // Version history handlers
  const handleRestoreVersion = (version: VersionEntry) => {
    // Save current content as a version before restoring
    const currentChapter = chapters.find((ch) => ch.id === version.chapterId);
    if (currentChapter) {
      addVersion({
        id: `v-${Date.now()}`,
        timestamp: new Date().toISOString(),
        author: "You",
        chapterId: version.chapterId,
        chapterTitle: currentChapter.title,
        content: currentChapter.content,
        type: "manual",
        label: "Before restore",
      });
    }
    
    // Restore the selected version
    updateChapterContent(version.chapterId, version.content);
    setActiveChapter(version.chapterId);
    setStatusMessage(`Restored version from ${new Date(version.timestamp).toLocaleString()}`);
  };

  const handleCompareVersion = (version: VersionEntry) => {
    // In a real implementation, this would open a diff view
    setStatusMessage(`Comparing with version from ${new Date(version.timestamp).toLocaleString()}`);
  };

  return (
    <ThemeProvider theme={theme === "dark" ? darkTheme : lightTheme}>
      <CssBaseline />
      <Box sx={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
        {/* Top Bar - always visible */}
        <Fade in={!focusModeActive}>
          <Box>
            <TopBar projectTitle="My Book Draft" onSave={handleSave} onExport={handleExport} />
          </Box>
        </Fade>

        {/* Main Content Area */}
        <Box
          sx={{
            display: "flex",
            width: "100%",
            height: focusModeActive ? "100vh" : "calc(100vh - 128px)",
            mt: focusModeActive ? 0 : "64px",
            mb: focusModeActive ? 0 : "64px",
            transition: "all 0.3s ease",
          }}
        >
        {/* Collaboration Panel - Left Side */}
        {panelVisibility.collaboration && (
          <CollaborationPanel
            collaborators={collaborators}
            messages={collabMessages}
            currentUserId={currentUserId}
            sessionId={sessionId || undefined}
            onInvite={handleInviteCollaborator}
            onSendMessage={handleSendCollabMessage}
            onJumpToCollaborator={handleJumpToCollaborator}
            collapsed={!panelVisibility.collaboration}
            onToggleCollapse={() => togglePanel("collaboration")}
          />
        )}

        {/* Main Split Pane */}
        <Box sx={{ flex: 1, minWidth: 0, display: "flex", overflow: "hidden" }}>
          <MainLayout
            left={
              panelVisibility.chapterNav ? (
                <BookPane
                  chapters={chapters}
                  activeChapterId={activeChapterId}
                  onSelectChapter={setActiveChapter}
                  onContentChange={handleContentChangeWithVersion}
                  onAddChapter={handleAddChapter}
                  forceCollapseDrawer={focusModeActive}
                  isFocusMode={focusModeActive}
                />
              ) : null
            }
            right={
              panelVisibility.aiPane ? (
                <AIPane
                  messages={messages}
                  suggestions={suggestions}
                  loading={aiLoading}
                  onSendMessage={handleSendMessage}
                  onInsertSuggestion={handleInsertSuggestion}
                  onDismissSuggestion={handleDismissSuggestion}
                  onGenerateImage={handleGenerateImage}
                  onSearchWeb={handleSearchWeb}
                />
              ) : null
            }
            defaultLeftWidth={panelVisibility.chapterNav && panelVisibility.aiPane ? 60 : 100}
          />
        </Box>

        {/* Version History Panel - Right Side */}
        {panelVisibility.versionHistory && (
          <VersionHistoryPanel
            versions={versions}
            onRestore={handleRestoreVersion}
            onCompare={handleCompareVersion}
            collapsed={!panelVisibility.versionHistory}
            onToggleCollapse={() => togglePanel("versionHistory")}
          />
        )}
      </Box>

      {/* Bottom Bar - hidden in focus mode */}
      <Fade in={!focusModeActive}>
        <Box>
          <BottomBar
            aiMode={aiMode}
            onAIModeChange={setAIMode}
            onExportPDF={handleExportPDF}
            onExportDOCX={handleExportDOCX}
            onCollaborate={handleCollaborate}
          />
        </Box>
      </Fade>

      {/* Focus Mode Controls - always visible */}
      <FocusModeControls
        focusModeActive={focusModeActive}
        panelVisibility={panelVisibility}
        onToggleFocusMode={toggleFocusMode}
        onTogglePanel={togglePanel}
      />
      </Box>
    </ThemeProvider>
  );
};

export default BookApp;
