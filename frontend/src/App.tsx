import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, API_BASE } from "./api";
import { PhaseStepper, Phase } from "./components/PhaseStepper";
import { SectionAccordion } from "./components/SectionAccordion";
import { Section, SessionPayload } from "./types";
import "./App.css";

const PHASES: Phase[] = [
  { id: "0", label: "Initial" },
  { id: "1.1", label: "Select Topic" },
  { id: "1.2", label: "Generate Topic" },
  { id: "2", label: "Display Result" },
  { id: "3.1", label: "Chat" },
  { id: "3.2", label: "Edit & Diff" },
  { id: "4", label: "Finalize" },
];

type Fragment = {
  id: string;
  tag: string;
  text: string;
};

type ChatEntry = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: string;
  toolName?: string;
  assetPath?: string;
  snippet?: string;
};

type ChatMode =
  | "chat"
  | "internet_search"
  | "wikipedia_lookup"
  | "arxiv_search"
  | "diagram"
  | "deepagent";

const truncate = (text: string, limit: number = 160) =>
  text.length > limit ? `${text.slice(0, limit).trim()}…` : text;

const instrumentPreview = (html: string): { html: string; fragments: Fragment[] } => {
  if (!html?.trim() || typeof window === "undefined" || typeof DOMParser === "undefined") {
    return { html, fragments: [] };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const selectors = ["p", "li", "blockquote", "pre", "figure", "table", "h3", "h4"];
  const nodes = Array.from(
    doc.body.querySelectorAll(selectors.join(",")) as NodeListOf<HTMLElement>
  );
  const fragments: Fragment[] = nodes.map((node, idx) => {
    const id = `frag-${idx}`;
    node.setAttribute("data-fragment-id", id);
    return {
      id,
      tag: node.tagName.toLowerCase(),
      text: node.textContent?.trim() ?? "",
    };
  });

  return { html: doc.body.innerHTML || html, fragments };
};

function App() {
  const [topicOptions, setTopicOptions] = useState<string[]>([]);
  const [topic, setTopic] = useState("Agentic Security");
  const [modelName, setModelName] = useState("ollama:gpt-oss");
  const [contextSlug, setContextSlug] = useState<string | null>(null);
  const [workingSections, setWorkingSections] = useState<Section[]>([]);
  const [originalSections, setOriginalSections] = useState<Section[]>([]);
  const [workingVersions, setWorkingVersions] = useState<{ name: string; timestamp: string }[]>(
    []
  );
  const [originalVersions, setOriginalVersions] = useState<
    { name: string; timestamp: string }[]
  >([]);
  const [docPerspective, setDocPerspective] = useState<"working" | "original">("working");
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  const [sectionBody, setSectionBody] = useState("");
  const [lastSavedBody, setLastSavedBody] = useState("");
  const [sectionPreview, setSectionPreview] = useState("<p><em>Select a section.</em></p>");
  const [sectionDiff, setSectionDiff] = useState<string>("<p>Select a section.</p>");
  const [selectedFragmentId, setSelectedFragmentId] = useState<string | null>(null);
  const [selectedFragmentText, setSelectedFragmentText] = useState("");
  const [status, setStatus] = useState("Idle.");
  const [phase, setPhase] = useState("0");
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatEntry[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatMode, setChatMode] = useState<ChatMode>("chat");
  const [chatLoading, setChatLoading] = useState(false);
  const [pendingSnippet, setPendingSnippet] = useState<string | null>(null);
  const [pendingPlacementNote, setPendingPlacementNote] = useState("");
  const assetOrigin = useMemo(() => {
    try {
      return new URL(API_BASE).origin;
    } catch {
      return window.location.origin;
    }
  }, []);

  const previewRef = useRef<HTMLDivElement | null>(null);

  const sections = workingSections;
  const docSections = docPerspective === "working" ? workingSections : originalSections;

  const rewriteMediaSources = useCallback(
    (html: string | null | undefined) => {
      if (!html || typeof window === "undefined" || typeof DOMParser === "undefined") {
        return html ?? "";
      }
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const toAbsolute = (value: string | null) => {
        if (!value) return value;
        const normalized = value.trim();
        if (!normalized || normalized.startsWith("http") || normalized.startsWith("data:")) {
          return normalized;
        }
        const trimmed = normalized.replace(/^\.?\//, "");
        return `${assetOrigin}/${trimmed}`;
      };
      doc.querySelectorAll("img, video, audio, source").forEach((node) => {
        const attr = node.getAttribute("src");
        const updated = toAbsolute(attr);
        if (updated && updated !== attr) {
          node.setAttribute("src", updated);
        }
      });
      doc.querySelectorAll("a").forEach((node) => {
        const attr = node.getAttribute("href");
        const updated = toAbsolute(attr);
        if (updated && updated !== attr) {
          node.setAttribute("href", updated);
        }
      });
      return doc.body.innerHTML;
    },
    [assetOrigin]
  );
  const normalizedPreview = useMemo(
    () => rewriteMediaSources(sectionPreview),
    [sectionPreview, rewriteMediaSources]
  );
  const normalizeSections = useCallback(
    (records: Section[]) =>
      records.map((entry) => ({
        ...entry,
        html: rewriteMediaSources(entry.html),
      })),
    [rewriteMediaSources]
  );
  const effectivePreview = useMemo(() => {
    if (!pendingSnippet) {
      return normalizedPreview;
    }
    const base = normalizedPreview?.trim() || "";
    const spacer = base ? "\n" : "";
    return `${base}${spacer}<div class="pending-preview-block" data-pending="true">${pendingSnippet}</div>`;
  }, [normalizedPreview, pendingSnippet]);
  const { html: instrumentedPreview, fragments } = useMemo(
    () => instrumentPreview(effectivePreview),
    [effectivePreview]
  );

  const insertSnippetIntoBody = useCallback(
    (baseHtml: string, snippetHtml: string, fragmentIndex: number | null): string => {
      if (!snippetHtml.trim()) {
        return baseHtml;
      }
      if (typeof window === "undefined" || typeof DOMParser === "undefined") {
        const trimmed = baseHtml.trimEnd();
        const spacer = trimmed ? "\n\n" : "";
        return `${trimmed}${spacer}${snippetHtml}`;
      }
      const parser = new DOMParser();
      const doc = parser.parseFromString(baseHtml || "<div></div>", "text/html");
      const selectors = ["p", "li", "blockquote", "pre", "figure", "table", "h3", "h4"];
      const candidateNodes = Array.from(
        doc.body.querySelectorAll(selectors.join(",")) as NodeListOf<HTMLElement>
      );
      const target =
        fragmentIndex != null && fragmentIndex >= 0 ? candidateNodes[fragmentIndex] : null;
      const wrapper = doc.createElement("div");
      wrapper.innerHTML = snippetHtml.trim();
      const insertionNodes = Array.from(wrapper.childNodes);
      const parent = (target?.parentNode as Node) ?? doc.body;
      const referenceNode = target?.nextSibling ?? null;
      insertionNodes.forEach((node) => {
        parent.insertBefore(node, referenceNode);
      });
      return doc.body.innerHTML;
    },
    []
  );

  const documentOutline = useMemo(
    () => sections.map((sec) => `${sec.index}. ${sec.title}`).join("\n"),
    [sections]
  );
  const selectedSectionMeta = useMemo(
    () => sections.find((sec) => sec.index === selectedSection) ?? null,
    [sections, selectedSection]
  );

  const sectionWordCount = useMemo(() => {
    if (!sectionBody.trim()) return 0;
    return sectionBody.trim().split(/\s+/).length;
  }, [sectionBody]);

  const selectFragmentById = useCallback(
    (fragmentId: string | null) => {
      setSelectedFragmentId(fragmentId);
      if (!fragmentId) {
        setSelectedFragmentText("");
        return;
      }
      const fragment = fragments.find((frag) => frag.id === fragmentId);
      setSelectedFragmentText(fragment?.text ?? "");
    },
    [fragments]
  );

  const pushExcerptToChat = () => {
    if (!selectedFragmentText) return;
    setChatInput((prev) =>
      prev ? `${prev}\n\nFocus on this excerpt:\n${selectedFragmentText}` : selectedFragmentText
    );
  };

  const renderChatContent = (msg: ChatEntry) => {
    const trimmed = msg.content?.trim();
    const looksLikeHtml = !!trimmed && /<[^>]+>/g.test(trimmed);
    if (msg.role !== "user" && looksLikeHtml) {
      return <div className="collab-message__body" dangerouslySetInnerHTML={{ __html: trimmed }} />;
    }
    return <p>{msg.content}</p>;
  };

  const makeChatEntry = useCallback(
    (
      role: ChatEntry["role"],
      content: string,
      toolName?: string,
      assetPath?: string,
      snippet?: string
    ): ChatEntry => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role,
      content,
      toolName,
      assetPath,
      snippet,
      timestamp: new Date().toLocaleTimeString(),
    }),
    []
  );

  const appendChatEntry = useCallback((entry: ChatEntry) => {
    setChatMessages((prev) => [...prev, entry]);
  }, []);

  const chatModeLabels: Record<ChatMode, { label: string; placeholder: string; button: string }> = {
    chat: {
      label: "Chat with reasoning LLM",
      placeholder: "Ask for critiques, rewrites, or new ideas for this section.",
      button: "Send message",
    },
    internet_search: {
      label: "Run web search",
      placeholder: "Describe what to search for (e.g., zero trust case studies).",
      button: "Search web",
    },
    wikipedia_lookup: {
      label: "Wikipedia summary",
      placeholder: "Enter a topic for a quick Wikipedia summary.",
      button: "Lookup topic",
    },
    arxiv_search: {
      label: "arXiv search",
      placeholder: "Enter keywords to fetch recent arXiv papers.",
      button: "Search arXiv",
    },
    diagram: {
      label: "Generate diagram",
      placeholder: "Describe the architecture or flow that needs a diagram.",
      button: "Generate diagram",
    },
    deepagent: {
      label: "DeepAgent auto-edit",
      placeholder: "Describe exactly how you want this section changed.",
      button: "Apply with DeepAgent",
    },
  };

  const messagesForApi = useCallback(
    (entries: ChatEntry[]) =>
      entries.map((entry) => ({
        role: entry.role,
        content: entry.content,
        tool_name: entry.toolName,
      })),
    []
  );

  const lastAssistantMessage = useMemo(
    () => [...chatMessages].reverse().find((msg) => msg.role === "assistant") ?? null,
    [chatMessages]
  );

  const lastUserMessage = useMemo(
    () => [...chatMessages].reverse().find((msg) => msg.role === "user") ?? null,
    [chatMessages]
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await api.listTopics();
        setTopicOptions(res.topics);
        const first = res.topics[0] ?? null;
        if (first && !res.topics.includes(topic)) {
          setTopic(first);
        }
        if (first) {
          setContextSlug((prev) => prev ?? first);
        }
      } catch (error) {
        console.error("Failed to load topics", error);
      }
    })();
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!sectionBody.trim()) {
        setSectionPreview("<p><em>No content.</em></p>");
        return;
      }
      try {
        const res = await api.renderSection(sectionBody);
        setSectionPreview(rewriteMediaSources(res.html));
      } catch (error) {
        console.error("Failed to render section", error);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [sectionBody, rewriteMediaSources]);

  useEffect(() => {
    setSelectedFragmentId(null);
    setSelectedFragmentText("");
  }, [sectionPreview]);

  useEffect(() => {
    if (!previewRef.current) return;
    const nodes = previewRef.current.querySelectorAll("[data-fragment-id]");
    nodes.forEach((node) => node.removeAttribute("data-active"));
    if (selectedFragmentId) {
      const active = previewRef.current.querySelector(
        `[data-fragment-id="${selectedFragmentId}"]`
      ) as HTMLElement | null;
      if (active) {
        active.setAttribute("data-active", "true");
        active.scrollIntoView({ block: "nearest" });
      }
    }
  }, [instrumentedPreview, selectedFragmentId]);

  const handleApi = useCallback(async <T,>(fn: () => Promise<T>, nextPhase?: string, success?: (res: T) => void) => {
    try {
      setLoading(true);
      const result = await fn();
      if (success) success(result);
      if (nextPhase) setPhase(nextPhase);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleResolve = () =>
    handleApi(
      () => api.resolveTopic(topic),
      "1.1",
      (res) => {
        setContextSlug(res.context_path);
        setStatus(res.message);
      }
    );

  const handleGenerate = () =>
    handleApi(
      () => api.generateTopic(topic, modelName),
      "1.2",
      (res) => {
        setContextSlug(res.context_path);
        setStatus(res.message);
      }
    );

  const loadSession = useCallback(
    (
      slugOverride?: string,
      nextPhase?: string,
      options?: { resetVersions?: boolean; focusSection?: number | null }
    ) => {
      const slug = slugOverride ?? contextSlug;
      if (!slug) {
        setStatus("Resolve or generate a topic before initializing a session.");
        return;
      }
      const { resetVersions = true, focusSection } = options ?? {};
      return handleApi(
        () =>
          api.initSession({
            context_path: slug,
            model_name: modelName,
          }),
        nextPhase ?? "2",
        (res: SessionPayload) => {
          setContextSlug(res.context_path);
          const normalizedWorking = normalizeSections(res.sections);
          const normalizedOriginal = normalizeSections(res.original_sections);
          setWorkingSections(normalizedWorking);
          setOriginalSections(normalizedOriginal);
          if (resetVersions) {
            setWorkingVersions(res.working_versions ?? []);
            setOriginalVersions(res.original_versions ?? []);
          }
          const fallbackIndex = normalizedWorking[0]?.index ?? null;
          const desiredIndex = focusSection !== undefined ? focusSection : fallbackIndex;
          const nextSection =
            desiredIndex != null
              ? normalizedWorking.find((sec) => sec.index === desiredIndex)
              : normalizedWorking[0];
          const nextIndex = nextSection?.index ?? fallbackIndex;
          const nextBody = nextSection?.body ?? "";
          const nextHtml = nextSection?.html ?? "<p><em>No section.</em></p>";
          setSelectedSection(nextIndex);
          setSectionBody(nextBody);
          setLastSavedBody(nextBody);
          setSectionPreview(nextHtml);
          setSectionDiff(res.diff_html);
          setChatMessages([]);
          setSelectedFragmentId(null);
          setSelectedFragmentText("");
          setPendingSnippet(null);
          setDocPerspective("working");
          setStatus("Session ready.");
        }
      );
    },
    [contextSlug, handleApi, modelName, normalizeSections]
  );

  const handleInit = () => loadSession(undefined, "2");

  const handleSendChatMessage = async () => {
    if (!contextSlug) {
      setStatus("Resolve or initialize a topic before chatting.");
      return;
    }
    if (selectedSection == null) {
      setStatus("Select a section before starting the chat.");
      return;
    }
    const trimmed = chatInput.trim();
    if (!trimmed) {
      setStatus("Enter a message or query before sending.");
      return;
    }
    const userEntry = makeChatEntry("user", trimmed);
    const nextMessages = [...chatMessages, userEntry];
    appendChatEntry(userEntry);
    setChatInput("");
    setChatLoading(true);
    if (chatMode === "chat") {
      try {
        const res = await api.sectionChat({
          context_path: contextSlug,
          section_index: selectedSection ?? undefined,
          model_name: modelName,
          messages: messagesForApi(nextMessages),
        });
        appendChatEntry(makeChatEntry("assistant", res.message));
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error));
      } finally {
        setChatLoading(false);
      }
      return;
    }
    if (chatMode === "deepagent") {
      try {
        const res = await api.deepAgentEdit({
          context_path: contextSlug,
          section_index: selectedSection,
          message: trimmed,
          model_name: modelName,
        });
        appendChatEntry(makeChatEntry("assistant", res.message));
        setSectionBody(res.html);
        setSectionPreview(rewriteMediaSources(res.html));
        setStatus("DeepAgent applied your request. Review and save if satisfied.");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error));
      } finally {
        setChatLoading(false);
      }
      return;
    }
    try {
      const res = await api.runTool({
        context_path: contextSlug,
        section_index: selectedSection ?? undefined,
        model_name: modelName,
        tool: chatMode,
        query: trimmed,
      });
      const snippetHtml = res.snippet ? rewriteMediaSources(res.snippet.trim()) : undefined;
      appendChatEntry(
        makeChatEntry("tool", res.content, res.tool_name, res.asset_path, snippetHtml)
      );
      if (snippetHtml) {
        setPendingSnippet(snippetHtml);
        setPendingPlacementNote("");
        setStatus(
          "Review the diagram. Select a paragraph to target placement, then accept or ask the LLM to position it."
        );
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setChatLoading(false);
    }
  };

  const handlePreviewClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement).closest("[data-fragment-id]") as
      | HTMLElement
      | null;
    const fragmentId = target?.getAttribute("data-fragment-id");
    if (!fragmentId) return;
    selectFragmentById(fragmentId);
  };

  const refreshDiff = async (sectionIndex: number) => {
    if (!contextSlug) return;
    try {
      const res = await api.sectionDiff({
        context_path: contextSlug,
        section_index: sectionIndex,
      });
      setSectionDiff(res.diff_html);
    } catch (error) {
      setSectionDiff(`<p>${error instanceof Error ? error.message : String(error)}</p>`);
    }
  };

  const selectSection = async (index: number) => {
    if (docPerspective !== "working") {
      setDocPerspective("working");
    }
    setSelectedSection(index);
    const section = sections.find((sec) => sec.index === index);
    setSectionBody(section?.body ?? "");
    setSectionPreview(section?.html ?? "<p><em>No section.</em></p>");
    setLastSavedBody(section?.body ?? "");
    setChatMessages([]);
    setPendingSnippet(null);
    selectFragmentById(null);
    await refreshDiff(index);
  };

  const handleAcceptPendingSnippet = () => {
    if (!pendingSnippet) return;
    const fragmentIndex =
      selectedFragmentId != null
        ? fragments.findIndex((frag) => frag.id === selectedFragmentId)
        : null;
    const updatedHtml = insertSnippetIntoBody(sectionBody, pendingSnippet, fragmentIndex);
    setSectionBody(updatedHtml);
    setSectionPreview(rewriteMediaSources(updatedHtml));
    setPendingSnippet(null);
    setPendingPlacementNote("");
    setStatus(
      fragmentIndex != null
        ? "Diagram inserted after the selected paragraph. Review and save."
        : "Diagram added to the end of the section. Review and save."
    );
  };

  const handleRejectPendingSnippet = () => {
    setPendingSnippet(null);
    setPendingPlacementNote("");
    setStatus("Pending diagram change discarded.");
  };

  const handleLLMPlacement = () => {
    if (!contextSlug || selectedSection == null || !pendingSnippet) return;
    const userNote = pendingPlacementNote.trim();
    const hint = userNote
      ? userNote
      : selectedFragmentText
      ? `Place it immediately after the paragraph that begins: "${truncate(
          selectedFragmentText,
          120
        )}".`
      : "Choose the most relevant paragraph and introduce the figure there.";
    const instruction = [
      "Insert or move the following HTML snippet exactly as provided. Do not rewrite the markup inside the snippet.",
      `Snippet:\n${pendingSnippet}`,
      `Placement request: ${hint}`,
      "Preserve the surrounding HTML content except for minimal edits needed to reference the figure. Return only the updated section HTML.",
    ].join("\n\n");
    handleApi(
      () =>
        api.llmRewrite({
          context_path: contextSlug,
          section_index: selectedSection,
          instruction,
          model_name: modelName,
        }),
      undefined,
      (res) => {
        setSectionBody(res.body);
        setSectionPreview(rewriteMediaSources(res.body));
        setPendingSnippet(null);
        setPendingPlacementNote("");
        setStatus("LLM repositioned the diagram. Review the preview and save when satisfied.");
      }
    );
  };

  const handleSaveSection = () => {
    if (!contextSlug || selectedSection == null) return;
    handleApi(
      () =>
        api.saveSection({
          context_path: contextSlug,
          section_index: selectedSection,
          new_body: sectionBody,
        }),
      "3.2",
      () => {
        setStatus("Section saved.");
        setWorkingVersions((prev) => [
          ...prev,
          { name: `Version ${prev.length + 1}`, timestamp: new Date().toLocaleString() },
        ]);
        setLastSavedBody(sectionBody);
        setChatMessages([]);
        loadSession(undefined, undefined, { resetVersions: false, focusSection: selectedSection });
      }
    );
  };

  const handlePromote = () => {
    if (!contextSlug || selectedSection == null) return;
    handleApi(
      () => api.promote({ context_path: contextSlug, section_index: selectedSection }),
      "3.2",
      () => {
        setStatus("Working version promoted to original.");
        setOriginalVersions((prev) => [
          ...prev,
          { name: `Original v${prev.length + 1}`, timestamp: new Date().toLocaleString() },
        ]);
        setChatMessages([]);
        loadSession(undefined, undefined, { resetVersions: false, focusSection: selectedSection });
      }
    );
  };

  const handleRestoreSection = () => {
    setSectionBody(lastSavedBody);
    setStatus("Reverted to the last saved version of this section.");
  };

  const handleLLMRewrite = () => {
    if (!contextSlug || selectedSection == null) return;
    const instructionPayload =
      lastAssistantMessage?.content?.trim() ||
      selectedFragmentText ||
      lastUserMessage?.content?.trim() ||
      "";
    if (!instructionPayload) {
      setStatus("Hold a brief chat or select an excerpt before applying a rewrite.");
      return;
    }
    appendChatEntry(makeChatEntry("user", `[Apply to section]\n${instructionPayload}`));
    handleApi(
      () =>
        api.llmRewrite({
          context_path: contextSlug,
          section_index: selectedSection,
          instruction: instructionPayload,
          model_name: modelName,
        }),
      undefined,
      (res) => {
        setSectionBody(res.body);
        setStatus("LLM rewrite ready. Review and save if acceptable.");
        appendChatEntry(
          makeChatEntry(
            "assistant",
            "Draft updated with the latest plan. Review the preview and save when satisfied."
          )
        );
      }
    );
  };

  const handleRegenerate = () => {
    handleApi(
      () =>
        api.regenerate({
          topic,
          model_name: modelName,
        }),
      "4",
      (res: SessionPayload & { context_path: string; message: string }) => {
        setContextSlug(res.context_path);
        const normalizedWorking = normalizeSections(res.sections);
        const normalizedOriginal = normalizeSections(res.original_sections);
        setWorkingSections(normalizedWorking);
        setOriginalSections(normalizedOriginal);
        setWorkingVersions(res.working_versions ?? []);
        setOriginalVersions(res.original_versions ?? []);
        const firstIndex = normalizedWorking[0]?.index ?? null;
        const firstBody = normalizedWorking[0]?.body ?? "";
        setSelectedSection(firstIndex);
        setSectionBody(firstBody);
        setLastSavedBody(firstBody);
        setSectionPreview(normalizedWorking[0]?.html ?? "<p><em>No section.</em></p>");
        setSectionDiff(res.diff_html);
        setChatMessages([]);
        setSelectedFragmentId(null);
        setSelectedFragmentText("");
        setDocPerspective("working");
        setStatus(res.message);
        setPendingSnippet(null);
      }
    );
  };

  const phaseLabel = useMemo(() => {
    const phaseObj = PHASES.find((p) => p.id === phase);
    return phaseObj ? `${phaseObj.id} – ${phaseObj.label}` : "";
  }, [phase]);

  return (
    <div className="app-shell">
      <header>
        <h1>DeepAgents Research Chat</h1>
        <p>{phaseLabel}</p>
        <PhaseStepper phases={PHASES} current={phase} />
        <div className="status-bar">{status}</div>
      </header>

      <section className="controls">
        <div className="field-group">
          <label>Topic</label>
          <input list="topic-options" value={topic} onChange={(e) => setTopic(e.target.value)} />
          <datalist id="topic-options">
            {topicOptions.map((opt) => (
              <option value={opt} key={opt} />
            ))}
          </datalist>
        </div>
        <div className="field-group readonly-field">
          <label>Topic ID</label>
          <div className="readonly-chip">{contextSlug ?? "Resolve or generate to load ID"}</div>
        </div>
        <div className="field-group">
          <label>LLM Provider</label>
          <input value={modelName} onChange={(e) => setModelName(e.target.value)} />
        </div>
        <div className="button-row">
          <button onClick={handleResolve} disabled={loading}>
            Resolve Topic
          </button>
          <button onClick={handleGenerate} disabled={loading}>
            Generate Topic
          </button>
          <button onClick={handleInit} disabled={loading || !contextSlug}>
            Initialize Session
          </button>
          <button onClick={handleRegenerate} disabled={loading}>
            Re-run Planning & Research
          </button>
        </div>
      </section>

      <section className="document-zone">
        <div className="document-header">
          <div>
            <h2>Document Navigator</h2>
            <p>Expand a chapter to review it, then open the section in the collaboration studio.</p>
          </div>
          <div className="doc-toggle">
            <button
              type="button"
              className={docPerspective === "working" ? "active" : ""}
              onClick={() => setDocPerspective("working")}
            >
              Working Draft
            </button>
            <button
              type="button"
              className={docPerspective === "original" ? "active" : ""}
              onClick={() => setDocPerspective("original")}
            >
              Original Baseline
            </button>
          </div>
        </div>
        <SectionAccordion
          sections={docSections}
          selected={selectedSection}
          onSelect={selectSection}
          perspective={docPerspective}
        />
        <div className="versions-grid">
          <div>
            <h3>Working Versions</h3>
            <ul>
              {workingVersions.map((entry, idx) => (
                <li key={`${entry.name}-${idx}`}>
                  <strong>{entry.name}</strong> – {entry.timestamp}
                </li>
              ))}
              {!workingVersions.length && <li>No working versions yet.</li>}
            </ul>
          </div>
          <div>
            <h3>Original Versions</h3>
            <ul>
              {originalVersions.map((entry, idx) => (
                <li key={`${entry.name}-${idx}`}>
                  <strong>{entry.name}</strong> – {entry.timestamp}
                </li>
              ))}
              {!originalVersions.length && <li>No original versions yet.</li>}
            </ul>
          </div>
        </div>
      </section>

      <section className="collab-zone">
        <div className="section-studio-card">
          <div className="section-editor__header">
            <div>
              <h3>Section Studio</h3>
              <p>
                {selectedSectionMeta
                  ? `${selectedSectionMeta.index}. ${selectedSectionMeta.title}`
                  : "Select a section from the navigator to start editing."}
              </p>
            </div>
            <div className="section-meta">
              <span className="meta-pill">Live preview</span>
              <span className="meta-pill">
                {docPerspective === "working" ? "Working draft" : "Original baseline"}
              </span>
              <span className="meta-pill">{sectionWordCount} words</span>
            </div>
          </div>
          <div className="section-quicksteps">
            <div>
              <strong>1. Target a paragraph</strong>
              <p>Click anywhere in the preview to focus edits or keep it blank to edit the whole section.</p>
            </div>
            <div>
              <strong>2. Ask or apply changes</strong>
              <p>Send a prompt or push the latest plan to rewrite the section automatically.</p>
            </div>
            <div>
              <strong>3. Save or promote</strong>
              <p>Persist updates, then promote the working draft to refresh the original baseline.</p>
            </div>
          </div>

          <div className="studio-layout">
            <div className="studio-layout__column">
              <div className="canvas-panel">
                <div className="canvas-panel__title">Rendered Preview</div>
                <div
                  ref={previewRef}
                  className="preview-pane rich-preview"
                  onClick={handlePreviewClick}
                  dangerouslySetInnerHTML={{
                    __html:
                      instrumentedPreview ||
                      "<p class='preview-empty'>Select a section to load a live preview.</p>",
                  }}
                />
              </div>
              <p className="preview-hint">
                Click any paragraph to focus the LLM on that excerpt. All updates flow through the
                collaboration panel.
              </p>
              <div className="section-editor__toolbar">
                <div className="button-row">
                  <button
                    onClick={handleSaveSection}
                    disabled={loading || selectedSection == null || !contextSlug}
                  >
                    Save Section Changes
                  </button>
                  <button
                    onClick={handlePromote}
                    disabled={loading || selectedSection == null || !contextSlug}
                  >
                    Promote Working to Original
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={handleRestoreSection}
                    disabled={sectionBody === lastSavedBody}
                  >
                    Restore last saved
                  </button>
                </div>
                <p className="toolbar-hint">
                  Save to persist this version. Restore brings back the most recently saved draft.
                </p>
              </div>
            </div>

            <div className="studio-layout__column">
              <div className="llm-panel">
                <h3>LLM + Collaboration</h3>
                {selectedFragmentText ? (
                  <div className="selected-fragment">
                    <div className="selected-fragment__header">
                      <strong>Focused excerpt</strong>
                      <button type="button" onClick={() => selectFragmentById(null)}>
                        Clear
                      </button>
                    </div>
                    <p>{selectedFragmentText}</p>
                    <div className="selected-fragment__actions">
                      <button type="button" onClick={pushExcerptToChat}>
                        Insert excerpt into message
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="selected-fragment__empty">
                    Click any paragraph in the preview to target LLM edits or leave it blank to edit the
                    whole section.
                  </p>
                )}
                {pendingSnippet && (
                  <div className="pending-snippet">
                    <div className="pending-snippet__header">
                      <strong>Pending diagram change</strong>
                    </div>
                    <div
                      className="pending-snippet__preview"
                      dangerouslySetInnerHTML={{ __html: pendingSnippet }}
                    />
                    <div className="pending-snippet__note">
                      <label>
                        Placement instructions (optional)
                        <textarea
                          value={pendingPlacementNote}
                          onChange={(e) => setPendingPlacementNote(e.target.value)}
                          placeholder="e.g., Place this figure after the Planner paragraph."
                        />
                      </label>
                      <p className="pending-snippet__hint">
                        Tip: select a paragraph in the preview to pinpoint the target, then accept or let the
                        LLM handle the placement.
                      </p>
                    </div>
                    <div className="pending-snippet__actions">
                      <button type="button" onClick={handleAcceptPendingSnippet}>
                        Accept change
                      </button>
                      <button type="button" className="ghost-button" onClick={handleRejectPendingSnippet}>
                        Reject change
                      </button>
                      <button
                        type="button"
                        onClick={handleLLMPlacement}
                        disabled={!contextSlug || selectedSection == null || !pendingSnippet || loading}
                      >
                        Ask LLM to place diagram
                      </button>
                    </div>
                  </div>
                )}
                <div className="collab-history">
                  <h4>Conversation</h4>
                  {chatMessages.length ? (
                    <ul>
                      {chatMessages.map((msg) => (
                        <li key={msg.id} className={`collab-message ${msg.role}`}>
                          <div className="collab-message__meta">
                            <span className="collab-message__role">
                              {msg.role === "user"
                                ? "Critique Agent"
                                : msg.role === "assistant"
                                ? "Reasoning LLM"
                                : msg.toolName
                                ? `Tool • ${msg.toolName}`
                                : "Tool"}
                            </span>
                            <span>{msg.timestamp}</span>
                          </div>
                          {renderChatContent(msg)}
                          {msg.snippet && (
                            <div
                              className="collab-message__snippet"
                              dangerouslySetInnerHTML={{ __html: msg.snippet }}
                            />
                          )}
                          {msg.assetPath && (
                            <p className="collab-message__asset">
                              Asset saved at: <code>{msg.assetPath}</code>
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="collab-message__empty">
                      Ask the reasoning LLM for ideas or run a tool to start the conversation.
                    </p>
                  )}
                </div>
                <div className="chat-composer">
                  <label>
                    Action
                    <select value={chatMode} onChange={(e) => setChatMode(e.target.value as ChatMode)}>
                      {Object.entries(chatModeLabels).map(([value, meta]) => (
                        <option key={value} value={value}>
                          {meta.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <textarea
                    placeholder={chatModeLabels[chatMode].placeholder}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    rows={chatMode === "chat" ? 4 : 3}
                    disabled={chatLoading}
                  />
                  <button onClick={handleSendChatMessage} disabled={chatLoading}>
                    {chatLoading ? "Working..." : chatModeLabels[chatMode].button}
                  </button>
                </div>
                <button
                  onClick={handleLLMRewrite}
                  disabled={loading || selectedSection == null || !contextSlug}
                >
                  Apply latest plan to section
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
      <details className="diff-card">
        <summary>Section Diff (optional)</summary>
        <div className="diff-pane" dangerouslySetInnerHTML={{ __html: sectionDiff }} />
        <button onClick={() => selectedSection && refreshDiff(selectedSection)} disabled={loading}>
          Refresh Diff
        </button>
      </details>
    </div>
  );
}

export default App;
