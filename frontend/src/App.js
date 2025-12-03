import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, API_BASE } from "./api";
import { PhaseStepper } from "./components/PhaseStepper";
import { SectionAccordion } from "./components/SectionAccordion";
import "./App.css";
const PHASES = [
    { id: "0", label: "Initial" },
    { id: "1.1", label: "Select Topic" },
    { id: "1.2", label: "Generate Topic" },
    { id: "2", label: "Display Result" },
    { id: "3.1", label: "Chat" },
    { id: "3.2", label: "Edit & Diff" },
    { id: "4", label: "Finalize" },
];
const truncate = (text, limit = 160) => text.length > limit ? `${text.slice(0, limit).trim()}…` : text;
const instrumentPreview = (html) => {
    if (!html?.trim() || typeof window === "undefined" || typeof DOMParser === "undefined") {
        return { html, fragments: [] };
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const selectors = ["p", "li", "blockquote", "pre", "figure", "table", "h3", "h4"];
    const nodes = Array.from(doc.body.querySelectorAll(selectors.join(",")));
    const fragments = nodes.map((node, idx) => {
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
    const [topicOptions, setTopicOptions] = useState([]);
    const [topic, setTopic] = useState("Agentic Security");
    const [modelName, setModelName] = useState("ollama:gpt-oss");
    const [contextSlug, setContextSlug] = useState(null);
    const [workingSections, setWorkingSections] = useState([]);
    const [originalSections, setOriginalSections] = useState([]);
    const [workingVersions, setWorkingVersions] = useState([]);
    const [originalVersions, setOriginalVersions] = useState([]);
    const [docPerspective, setDocPerspective] = useState("working");
    const [selectedSection, setSelectedSection] = useState(null);
    const [sectionBody, setSectionBody] = useState("");
    const [lastSavedBody, setLastSavedBody] = useState("");
    const [sectionPreview, setSectionPreview] = useState("<p><em>Select a section.</em></p>");
    const [sectionDiff, setSectionDiff] = useState("<p>Select a section.</p>");
    const [selectedFragmentId, setSelectedFragmentId] = useState(null);
    const [selectedFragmentText, setSelectedFragmentText] = useState("");
    const [status, setStatus] = useState("Idle.");
    const [phase, setPhase] = useState("0");
    const [loading, setLoading] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [chatMode, setChatMode] = useState("chat");
    const [chatLoading, setChatLoading] = useState(false);
    const [pendingSnippet, setPendingSnippet] = useState(null);
    const [pendingPlacementNote, setPendingPlacementNote] = useState("");
    const assetOrigin = useMemo(() => {
        try {
            return new URL(API_BASE).origin;
        }
        catch {
            return window.location.origin;
        }
    }, []);
    const previewRef = useRef(null);
    const sections = workingSections;
    const docSections = docPerspective === "working" ? workingSections : originalSections;
    const rewriteMediaSources = useCallback((html) => {
        if (!html || typeof window === "undefined" || typeof DOMParser === "undefined") {
            return html ?? "";
        }
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const toAbsolute = (value) => {
            if (!value)
                return value;
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
    }, [assetOrigin]);
    const normalizedPreview = useMemo(() => rewriteMediaSources(sectionPreview), [sectionPreview, rewriteMediaSources]);
    const normalizeSections = useCallback((records) => records.map((entry) => ({
        ...entry,
        html: rewriteMediaSources(entry.html),
    })), [rewriteMediaSources]);
    const effectivePreview = useMemo(() => {
        if (!pendingSnippet) {
            return normalizedPreview;
        }
        const base = normalizedPreview?.trim() || "";
        const spacer = base ? "\n" : "";
        return `${base}${spacer}<div class="pending-preview-block" data-pending="true">${pendingSnippet}</div>`;
    }, [normalizedPreview, pendingSnippet]);
    const { html: instrumentedPreview, fragments } = useMemo(() => instrumentPreview(effectivePreview), [effectivePreview]);
    const insertSnippetIntoBody = useCallback((baseHtml, snippetHtml, fragmentIndex) => {
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
        const candidateNodes = Array.from(doc.body.querySelectorAll(selectors.join(",")));
        const target = fragmentIndex != null && fragmentIndex >= 0 ? candidateNodes[fragmentIndex] : null;
        const wrapper = doc.createElement("div");
        wrapper.innerHTML = snippetHtml.trim();
        const insertionNodes = Array.from(wrapper.childNodes);
        const parent = target?.parentNode ?? doc.body;
        const referenceNode = target?.nextSibling ?? null;
        insertionNodes.forEach((node) => {
            parent.insertBefore(node, referenceNode);
        });
        return doc.body.innerHTML;
    }, []);
    const documentOutline = useMemo(() => sections.map((sec) => `${sec.index}. ${sec.title}`).join("\n"), [sections]);
    const selectedSectionMeta = useMemo(() => sections.find((sec) => sec.index === selectedSection) ?? null, [sections, selectedSection]);
    const sectionWordCount = useMemo(() => {
        if (!sectionBody.trim())
            return 0;
        return sectionBody.trim().split(/\s+/).length;
    }, [sectionBody]);
    const selectFragmentById = useCallback((fragmentId) => {
        setSelectedFragmentId(fragmentId);
        if (!fragmentId) {
            setSelectedFragmentText("");
            return;
        }
        const fragment = fragments.find((frag) => frag.id === fragmentId);
        setSelectedFragmentText(fragment?.text ?? "");
    }, [fragments]);
    const pushExcerptToChat = () => {
        if (!selectedFragmentText)
            return;
        setChatInput((prev) => prev ? `${prev}\n\nFocus on this excerpt:\n${selectedFragmentText}` : selectedFragmentText);
    };
    const decodeHtmlEntities = (value) => {
        if (!value)
            return value;
        if (typeof window === "undefined" || typeof DOMParser === "undefined") {
            return value;
        }
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<!doctype html><body>${value}</body>`, "text/html");
        return doc.body.textContent || value;
    };
    const renderChatContent = (msg) => {
        const baseContent = msg.content ?? "";
        const decoded = msg.role === "user" ? baseContent : decodeHtmlEntities(baseContent);
        const trimmed = decoded.trim();
        const looksLikeHtml = !!trimmed && /<[^>]+>/g.test(trimmed);
        if (msg.role !== "user" && looksLikeHtml) {
            return (_jsx("div", { className: "collab-message__body", dangerouslySetInnerHTML: { __html: trimmed } }));
        }
        return _jsx("p", { children: decoded });
    };
    const makeChatEntry = useCallback((role, content, toolName, assetPath, snippet) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role,
        content,
        toolName,
        assetPath,
        snippet,
        timestamp: new Date().toLocaleTimeString(),
    }), []);
    const appendChatEntry = useCallback((entry) => {
        setChatMessages((prev) => [...prev, entry]);
    }, []);
    const chatModeLabels = {
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
    const messagesForApi = useCallback((entries) => entries.map((entry) => ({
        role: entry.role,
        content: entry.content,
        tool_name: entry.toolName,
    })), []);
    const lastAssistantMessage = useMemo(() => [...chatMessages].reverse().find((msg) => msg.role === "assistant") ?? null, [chatMessages]);
    const lastUserMessage = useMemo(() => [...chatMessages].reverse().find((msg) => msg.role === "user") ?? null, [chatMessages]);
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
            }
            catch (error) {
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
            }
            catch (error) {
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
        if (!previewRef.current)
            return;
        const nodes = previewRef.current.querySelectorAll("[data-fragment-id]");
        nodes.forEach((node) => node.removeAttribute("data-active"));
        if (selectedFragmentId) {
            const active = previewRef.current.querySelector(`[data-fragment-id="${selectedFragmentId}"]`);
            if (active) {
                active.setAttribute("data-active", "true");
                active.scrollIntoView({ block: "nearest" });
            }
        }
    }, [instrumentedPreview, selectedFragmentId]);
    const handleApi = useCallback(async (fn, nextPhase, success) => {
        try {
            setLoading(true);
            const result = await fn();
            if (success)
                success(result);
            if (nextPhase)
                setPhase(nextPhase);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setStatus(message);
        }
        finally {
            setLoading(false);
        }
    }, []);
    const handleResolve = () => handleApi(() => api.resolveTopic(topic), "1.1", (res) => {
        setContextSlug(res.context_path);
        setStatus(res.message);
    });
    const handleGenerate = () => handleApi(() => api.generateTopic(topic, modelName), "1.2", (res) => {
        setContextSlug(res.context_path);
        setStatus(res.message);
    });
    const loadSession = useCallback((slugOverride, nextPhase, options) => {
        const slug = slugOverride ?? contextSlug;
        if (!slug) {
            setStatus("Resolve or generate a topic before initializing a session.");
            return;
        }
        const { resetVersions = true, focusSection } = options ?? {};
        return handleApi(() => api.initSession({
            context_path: slug,
            model_name: modelName,
        }), nextPhase ?? "2", (res) => {
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
            const nextSection = desiredIndex != null
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
        });
    }, [contextSlug, handleApi, modelName, normalizeSections]);
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
            }
            catch (error) {
                setStatus(error instanceof Error ? error.message : String(error));
            }
            finally {
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
            }
            catch (error) {
                setStatus(error instanceof Error ? error.message : String(error));
            }
            finally {
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
            appendChatEntry(makeChatEntry("tool", res.content, res.tool_name, res.asset_path, snippetHtml));
            if (snippetHtml) {
                setPendingSnippet(snippetHtml);
                setPendingPlacementNote("");
                setStatus("Review the diagram. Select a paragraph to target placement, then accept or ask the LLM to position it.");
            }
        }
        catch (error) {
            setStatus(error instanceof Error ? error.message : String(error));
        }
        finally {
            setChatLoading(false);
        }
    };
    const handlePreviewClick = (event) => {
        const target = event.target.closest("[data-fragment-id]");
        const fragmentId = target?.getAttribute("data-fragment-id");
        if (!fragmentId)
            return;
        selectFragmentById(fragmentId);
    };
    const refreshDiff = async (sectionIndex) => {
        if (!contextSlug)
            return;
        try {
            const res = await api.sectionDiff({
                context_path: contextSlug,
                section_index: sectionIndex,
            });
            setSectionDiff(res.diff_html);
        }
        catch (error) {
            setSectionDiff(`<p>${error instanceof Error ? error.message : String(error)}</p>`);
        }
    };
    const selectSection = async (index) => {
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
        if (!pendingSnippet)
            return;
        const fragmentIndex = selectedFragmentId != null
            ? fragments.findIndex((frag) => frag.id === selectedFragmentId)
            : null;
        const updatedHtml = insertSnippetIntoBody(sectionBody, pendingSnippet, fragmentIndex);
        setSectionBody(updatedHtml);
        setSectionPreview(rewriteMediaSources(updatedHtml));
        setPendingSnippet(null);
        setPendingPlacementNote("");
        setStatus(fragmentIndex != null
            ? "Diagram inserted after the selected paragraph. Review and save."
            : "Diagram added to the end of the section. Review and save.");
    };
    const handleRejectPendingSnippet = () => {
        setPendingSnippet(null);
        setPendingPlacementNote("");
        setStatus("Pending diagram change discarded.");
    };
    const handleLLMPlacement = () => {
        if (!contextSlug || selectedSection == null || !pendingSnippet)
            return;
        const userNote = pendingPlacementNote.trim();
        const hint = userNote
            ? userNote
            : selectedFragmentText
                ? `Place it immediately after the paragraph that begins: "${truncate(selectedFragmentText, 120)}".`
                : "Choose the most relevant paragraph and introduce the figure there.";
        const instruction = [
            "Insert or move the following HTML snippet exactly as provided. Do not rewrite the markup inside the snippet.",
            `Snippet:\n${pendingSnippet}`,
            `Placement request: ${hint}`,
            "Preserve the surrounding HTML content except for minimal edits needed to reference the figure. Return only the updated section HTML.",
        ].join("\n\n");
        handleApi(() => api.llmRewrite({
            context_path: contextSlug,
            section_index: selectedSection,
            instruction,
            model_name: modelName,
        }), undefined, (res) => {
            setSectionBody(res.body);
            setSectionPreview(rewriteMediaSources(res.body));
            setPendingSnippet(null);
            setPendingPlacementNote("");
            setStatus("LLM repositioned the diagram. Review the preview and save when satisfied.");
        });
    };
    const handleSaveSection = () => {
        if (!contextSlug || selectedSection == null)
            return;
        handleApi(() => api.saveSection({
            context_path: contextSlug,
            section_index: selectedSection,
            new_body: sectionBody,
        }), "3.2", () => {
            setStatus("Section saved.");
            setWorkingVersions((prev) => [
                ...prev,
                { name: `Version ${prev.length + 1}`, timestamp: new Date().toLocaleString() },
            ]);
            setLastSavedBody(sectionBody);
            setChatMessages([]);
            loadSession(undefined, undefined, { resetVersions: false, focusSection: selectedSection });
        });
    };
    const handlePromote = () => {
        if (!contextSlug || selectedSection == null)
            return;
        handleApi(() => api.promote({ context_path: contextSlug, section_index: selectedSection }), "3.2", () => {
            setStatus("Working version promoted to original.");
            setOriginalVersions((prev) => [
                ...prev,
                { name: `Original v${prev.length + 1}`, timestamp: new Date().toLocaleString() },
            ]);
            setChatMessages([]);
            loadSession(undefined, undefined, { resetVersions: false, focusSection: selectedSection });
        });
    };
    const handleRestoreSection = () => {
        setSectionBody(lastSavedBody);
        setStatus("Reverted to the last saved version of this section.");
    };
    const handleLLMRewrite = () => {
        if (!contextSlug || selectedSection == null)
            return;
        const instructionPayload = lastAssistantMessage?.content?.trim() ||
            selectedFragmentText ||
            lastUserMessage?.content?.trim() ||
            "";
        if (!instructionPayload) {
            setStatus("Hold a brief chat or select an excerpt before applying a rewrite.");
            return;
        }
        appendChatEntry(makeChatEntry("user", `[Apply to section]\n${instructionPayload}`));
        handleApi(() => api.llmRewrite({
            context_path: contextSlug,
            section_index: selectedSection,
            instruction: instructionPayload,
            model_name: modelName,
        }), undefined, (res) => {
            setSectionBody(res.body);
            setStatus("LLM rewrite ready. Review and save if acceptable.");
            appendChatEntry(makeChatEntry("assistant", "Draft updated with the latest plan. Review the preview and save when satisfied."));
        });
    };
    const handleRegenerate = () => {
        handleApi(() => api.regenerate({
            topic,
            model_name: modelName,
        }), "4", (res) => {
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
        });
    };
    const phaseLabel = useMemo(() => {
        const phaseObj = PHASES.find((p) => p.id === phase);
        return phaseObj ? `${phaseObj.id} – ${phaseObj.label}` : "";
    }, [phase]);
    return (_jsxs("div", { className: "app-shell", children: [_jsxs("header", { children: [_jsx("h1", { children: "DeepAgents Research Chat" }), _jsx("p", { children: phaseLabel }), _jsx(PhaseStepper, { phases: PHASES, current: phase }), _jsx("div", { className: "status-bar", children: status })] }), _jsxs("section", { className: "controls", children: [_jsxs("div", { className: "field-group", children: [_jsx("label", { children: "Topic" }), _jsx("input", { list: "topic-options", value: topic, onChange: (e) => setTopic(e.target.value) }), _jsx("datalist", { id: "topic-options", children: topicOptions.map((opt) => (_jsx("option", { value: opt }, opt))) })] }), _jsxs("div", { className: "field-group readonly-field", children: [_jsx("label", { children: "Topic ID" }), _jsx("div", { className: "readonly-chip", children: contextSlug ?? "Resolve or generate to load ID" })] }), _jsxs("div", { className: "field-group", children: [_jsx("label", { children: "LLM Provider" }), _jsx("input", { value: modelName, onChange: (e) => setModelName(e.target.value) })] }), _jsxs("div", { className: "button-row", children: [_jsx("button", { onClick: handleResolve, disabled: loading, children: "Resolve Topic" }), _jsx("button", { onClick: handleGenerate, disabled: loading, children: "Generate Topic" }), _jsx("button", { onClick: handleInit, disabled: loading || !contextSlug, children: "Initialize Session" }), _jsx("button", { onClick: handleRegenerate, disabled: loading, children: "Re-run Planning & Research" })] })] }), _jsxs("section", { className: "document-zone", children: [_jsxs("div", { className: "document-header", children: [_jsxs("div", { children: [_jsx("h2", { children: "Document Navigator" }), _jsx("p", { children: "Expand a chapter to review it, then open the section in the collaboration studio." })] }), _jsxs("div", { className: "doc-toggle", children: [_jsx("button", { type: "button", className: docPerspective === "working" ? "active" : "", onClick: () => setDocPerspective("working"), children: "Working Draft" }), _jsx("button", { type: "button", className: docPerspective === "original" ? "active" : "", onClick: () => setDocPerspective("original"), children: "Original Baseline" })] })] }), _jsx(SectionAccordion, { sections: docSections, selected: selectedSection, onSelect: selectSection, perspective: docPerspective }), _jsxs("div", { className: "versions-grid", children: [_jsxs("div", { children: [_jsx("h3", { children: "Working Versions" }), _jsxs("ul", { children: [workingVersions.map((entry, idx) => (_jsxs("li", { children: [_jsx("strong", { children: entry.name }), " \u2013 ", entry.timestamp] }, `${entry.name}-${idx}`))), !workingVersions.length && _jsx("li", { children: "No working versions yet." })] })] }), _jsxs("div", { children: [_jsx("h3", { children: "Original Versions" }), _jsxs("ul", { children: [originalVersions.map((entry, idx) => (_jsxs("li", { children: [_jsx("strong", { children: entry.name }), " \u2013 ", entry.timestamp] }, `${entry.name}-${idx}`))), !originalVersions.length && _jsx("li", { children: "No original versions yet." })] })] })] })] }), _jsx("section", { className: "collab-zone", children: _jsxs("div", { className: "section-studio-card", children: [_jsxs("div", { className: "section-editor__header", children: [_jsxs("div", { children: [_jsx("h3", { children: "Section Studio" }), _jsx("p", { children: selectedSectionMeta
                                                ? `${selectedSectionMeta.index}. ${selectedSectionMeta.title}`
                                                : "Select a section from the navigator to start editing." })] }), _jsxs("div", { className: "section-meta", children: [_jsx("span", { className: "meta-pill", children: "Live preview" }), _jsx("span", { className: "meta-pill", children: docPerspective === "working" ? "Working draft" : "Original baseline" }), _jsxs("span", { className: "meta-pill", children: [sectionWordCount, " words"] })] })] }), _jsxs("div", { className: "section-quicksteps", children: [_jsxs("div", { children: [_jsx("strong", { children: "1. Target a paragraph" }), _jsx("p", { children: "Click anywhere in the preview to focus edits or keep it blank to edit the whole section." })] }), _jsxs("div", { children: [_jsx("strong", { children: "2. Ask or apply changes" }), _jsx("p", { children: "Send a prompt or push the latest plan to rewrite the section automatically." })] }), _jsxs("div", { children: [_jsx("strong", { children: "3. Save or promote" }), _jsx("p", { children: "Persist updates, then promote the working draft to refresh the original baseline." })] })] }), _jsxs("div", { className: "studio-layout", children: [_jsxs("div", { className: "studio-layout__column", children: [_jsxs("div", { className: "canvas-panel", children: [_jsx("div", { className: "canvas-panel__title", children: "Rendered Preview" }), _jsx("div", { ref: previewRef, className: "preview-pane rich-preview", onClick: handlePreviewClick, dangerouslySetInnerHTML: {
                                                        __html: instrumentedPreview ||
                                                            "<p class='preview-empty'>Select a section to load a live preview.</p>",
                                                    } })] }), _jsx("p", { className: "preview-hint", children: "Click any paragraph to focus the LLM on that excerpt. All updates flow through the collaboration panel." }), _jsxs("div", { className: "section-editor__toolbar", children: [_jsxs("div", { className: "button-row", children: [_jsx("button", { onClick: handleSaveSection, disabled: loading || selectedSection == null || !contextSlug, children: "Save Section Changes" }), _jsx("button", { onClick: handlePromote, disabled: loading || selectedSection == null || !contextSlug, children: "Promote Working to Original" }), _jsx("button", { type: "button", className: "ghost-button", onClick: handleRestoreSection, disabled: sectionBody === lastSavedBody, children: "Restore last saved" })] }), _jsx("p", { className: "toolbar-hint", children: "Save to persist this version. Restore brings back the most recently saved draft." })] })] }), _jsx("div", { className: "studio-layout__column", children: _jsxs("div", { className: "llm-panel", children: [_jsx("h3", { children: "LLM + Collaboration" }), selectedFragmentText ? (_jsxs("div", { className: "selected-fragment", children: [_jsxs("div", { className: "selected-fragment__header", children: [_jsx("strong", { children: "Focused excerpt" }), _jsx("button", { type: "button", onClick: () => selectFragmentById(null), children: "Clear" })] }), _jsx("p", { children: selectedFragmentText }), _jsx("div", { className: "selected-fragment__actions", children: _jsx("button", { type: "button", onClick: pushExcerptToChat, children: "Insert excerpt into message" }) })] })) : (_jsx("p", { className: "selected-fragment__empty", children: "Click any paragraph in the preview to target LLM edits or leave it blank to edit the whole section." })), pendingSnippet && (_jsxs("div", { className: "pending-snippet", children: [_jsx("div", { className: "pending-snippet__header", children: _jsx("strong", { children: "Pending diagram change" }) }), _jsx("div", { className: "pending-snippet__preview", dangerouslySetInnerHTML: { __html: pendingSnippet } }), _jsxs("div", { className: "pending-snippet__note", children: [_jsxs("label", { children: ["Placement instructions (optional)", _jsx("textarea", { value: pendingPlacementNote, onChange: (e) => setPendingPlacementNote(e.target.value), placeholder: "e.g., Place this figure after the Planner paragraph." })] }), _jsx("p", { className: "pending-snippet__hint", children: "Tip: select a paragraph in the preview to pinpoint the target, then accept or let the LLM handle the placement." })] }), _jsxs("div", { className: "pending-snippet__actions", children: [_jsx("button", { type: "button", onClick: handleAcceptPendingSnippet, children: "Accept change" }), _jsx("button", { type: "button", className: "ghost-button", onClick: handleRejectPendingSnippet, children: "Reject change" }), _jsx("button", { type: "button", onClick: handleLLMPlacement, disabled: !contextSlug || selectedSection == null || !pendingSnippet || loading, children: "Ask LLM to place diagram" })] })] })), _jsxs("div", { className: "collab-history", children: [_jsx("h4", { children: "Conversation" }), chatMessages.length ? (_jsx("ul", { children: chatMessages.map((msg) => (_jsxs("li", { className: `collab-message ${msg.role}`, children: [_jsxs("div", { className: "collab-message__meta", children: [_jsx("span", { className: "collab-message__role", children: msg.role === "user"
                                                                                ? "Critique Agent"
                                                                                : msg.role === "assistant"
                                                                                    ? "Reasoning LLM"
                                                                                    : msg.toolName
                                                                                        ? `Tool • ${msg.toolName}`
                                                                                        : "Tool" }), _jsx("span", { children: msg.timestamp })] }), renderChatContent(msg), msg.snippet && (_jsx("div", { className: "collab-message__snippet", dangerouslySetInnerHTML: { __html: msg.snippet } })), msg.assetPath && (_jsxs("p", { className: "collab-message__asset", children: ["Asset saved at: ", _jsx("code", { children: msg.assetPath })] }))] }, msg.id))) })) : (_jsx("p", { className: "collab-message__empty", children: "Ask the reasoning LLM for ideas or run a tool to start the conversation." }))] }), _jsxs("div", { className: "chat-composer", children: [_jsxs("label", { children: ["Action", _jsx("select", { value: chatMode, onChange: (e) => setChatMode(e.target.value), children: Object.entries(chatModeLabels).map(([value, meta]) => (_jsx("option", { value: value, children: meta.label }, value))) })] }), _jsx("textarea", { placeholder: chatModeLabels[chatMode].placeholder, value: chatInput, onChange: (e) => setChatInput(e.target.value), rows: chatMode === "chat" ? 4 : 3, disabled: chatLoading }), _jsx("button", { onClick: handleSendChatMessage, disabled: chatLoading, children: chatLoading ? "Working..." : chatModeLabels[chatMode].button })] }), _jsx("button", { onClick: handleLLMRewrite, disabled: loading || selectedSection == null || !contextSlug, children: "Apply latest plan to section" })] }) })] })] }) }), _jsxs("details", { className: "diff-card", children: [_jsx("summary", { children: "Section Diff (optional)" }), _jsx("div", { className: "diff-pane", dangerouslySetInnerHTML: { __html: sectionDiff } }), _jsx("button", { onClick: () => selectedSection && refreshDiff(selectedSection), disabled: loading, children: "Refresh Diff" })] })] }));
}
export default App;
