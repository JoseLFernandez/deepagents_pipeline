/**
 * AI Middleware: Handles AI orchestration, logging, error handling, and caching.
 * Connects to the backend endpoints for chat, suggestions, and tool calls.
 */
import { useAIStore, } from "../state";
const API_BASE = "http://localhost:8000";
const AGENT_SYSTEM_PROMPTS = {
    generation: "You are the Generation Agent. Produce a high-quality draft that satisfies the user request. Focus on clarity, academic tone, and factual grounding. Return only the drafted prose without commentary.",
    reflection: "You are the Reflection Agent. Review the provided draft and list concrete improvements, missing citations, logical gaps, or stylistic issues. Respond with bullet points grouped by theme. Do not rewrite the draft.",
    critique: "You are the Critique Agent. Provide a peer-review style critique of the draft incorporating the reflection notes. Highlight redundancies, inconsistencies, and opportunities for strengthening the argument. Use numbered points.",
    editor: "You are the Editor Agent. Produce a polished final rewrite that incorporates the reflection findings and critique guidance. Maintain academic tone, add citations when needed, and ensure cohesive flow. Return the full rewritten text only.",
};
const AGENT_SEQUENCE = [
    "generation",
    "reflection",
    "critique",
    "editor",
];
const STAGE_CACHE_TTL = 1000 * 60 * 10; // 10 minutes
const stageCache = new Map();
function makeStageCacheKey(stage, prompt, context) {
    return JSON.stringify({ stage, prompt, context });
}
function getCachedStage(key) {
    const entry = stageCache.get(key);
    if (!entry)
        return undefined;
    const age = Date.now() - entry.createdAt;
    if (age > STAGE_CACHE_TTL) {
        stageCache.delete(key);
        return undefined;
    }
    return entry;
}
function setStageCache(key, value) {
    stageCache.set(key, value);
}
function buildStageUserPrompt(stage, userPrompt, context, priorResults) {
    const chapterSection = context
        ? `### Chapter Context
${context}
`
        : "";
    const requestSection = `### User Request
${userPrompt}
`;
    const draft = priorResults.find((r) => r.stage === "generation");
    const reflection = priorResults.find((r) => r.stage === "reflection");
    const critique = priorResults.find((r) => r.stage === "critique");
    switch (stage) {
        case "generation":
            return `${requestSection}${chapterSection}### Instructions
Craft a detailed draft that fulfils the request while adopting an academic tone.`;
        case "reflection":
            return `${requestSection}${chapterSection}### Draft for Reflection
${draft?.text ?? "No draft available."}

Identify missing citations, factual or logical issues, structural gaps, and opportunities to clarify the argument.`;
        case "critique":
            return `${requestSection}${chapterSection}### Draft Under Review
${draft?.text ?? "No draft available."}

### Reflection Notes
${reflection?.text ?? "No reflection notes provided."}

Provide a peer-review style critique with numbered findings and concrete recommendations.`;
        case "editor":
        default:
            return `${requestSection}${chapterSection}### Draft to Refine
${draft?.text ?? "No draft available."}

### Reflection Notes
${reflection?.text ?? "No reflection notes provided."}

### Critique Summary
${critique?.text ?? "No critique available."}

Produce the final polished rewrite that resolves every noted issue and includes citations where appropriate.`;
    }
}
async function executeAgentStage(stage, userPrompt, context, priorResults, options) {
    const prompt = buildStageUserPrompt(stage, userPrompt, context, priorResults);
    const cacheKey = makeStageCacheKey(stage, prompt, context);
    const cached = getCachedStage(cacheKey);
    if (cached) {
        pushAuditEntry({
            stage,
            status: "cached",
            message: `${stage} agent response served from cache`,
            details: { cacheKey },
        });
        return {
            stage,
            text: cached.text,
            notes: cached.notes,
            cached: true,
            prompt,
        };
    }
    pushAuditEntry({
        stage,
        status: "started",
        message: `${stage} agent started`,
        details: { promptPreview: prompt.slice(0, 160) },
    });
    const messages = [
        { role: "system", content: AGENT_SYSTEM_PROMPTS[stage] },
        { role: "user", content: prompt },
    ];
    try {
        const res = await callChatEndpoint(messages, {
            context,
            modelName: options?.modelName,
            label: `agent:${stage}`,
        });
        const text = res.message?.trim() ?? "";
        const result = {
            stage,
            text,
            notes: stage === "reflection" ? text : undefined,
            cached: false,
            prompt,
        };
        setStageCache(cacheKey, {
            stage,
            text,
            notes: result.notes,
            sourcePrompt: prompt,
            createdAt: Date.now(),
        });
        pushAuditEntry({
            stage,
            status: "success",
            message: `${stage} agent completed`,
            details: { length: text.length },
        });
        return result;
    }
    catch (error) {
        const message = handleError(error, `${stage}Agent`);
        pushAuditEntry({
            stage,
            status: "error",
            message: `${stage} agent failed`,
            details: { error: message },
        });
        throw error;
    }
}
const STAGE_NOTES = {
    generation: "Baseline draft generated for review.",
    reflection: "Issues and opportunities identified for improvement.",
    critique: "Critical feedback to address before final edit.",
    editor: "Final polished rewrite ready to insert.",
};
async function runAgentWorkflow(instruction, options = {}) {
    const results = [];
    const startedAt = Date.now();
    pushAuditEntry({
        stage: "request",
        status: "started",
        message: "Agentic workflow triggered",
        details: { instructionPreview: instruction.slice(0, 160) },
    });
    try {
        for (let index = 0; index < AGENT_SEQUENCE.length; index++) {
            const stage = AGENT_SEQUENCE[index];
            const stageResult = await executeAgentStage(stage, instruction, options.context, results, { modelName: options.modelName });
            results.push(stageResult);
            const { suggestions, updateSuggestion, addSuggestion } = useAIStore.getState();
            const existing = suggestions.find((s) => s.stage === stage);
            const suggestionId = existing?.id ?? `stage-${stage}-${Date.now()}-${Math.random()
                .toString(16)
                .slice(2, 8)}`;
            const cachedNotes = stageResult.cached ? " (served from cache)" : "";
            const notesBase = STAGE_NOTES[stage];
            const suggestionNotes = notesBase
                ? `${notesBase}${cachedNotes}`
                : cachedNotes || undefined;
            const suggestion = {
                id: suggestionId,
                type: stage,
                text: stageResult.text,
                chapterId: options.chapterId,
                createdAt: new Date().toISOString(),
                stage,
                stageOrder: index,
                sourcePrompt: stageResult.prompt,
                notes: suggestionNotes,
                cached: stageResult.cached,
            };
            if (existing) {
                updateSuggestion(existing.id, {
                    text: suggestion.text,
                    chapterId: suggestion.chapterId,
                    createdAt: suggestion.createdAt,
                    stageOrder: suggestion.stageOrder,
                    sourcePrompt: suggestion.sourcePrompt,
                    notes: suggestion.notes,
                    cached: suggestion.cached,
                });
            }
            else {
                addSuggestion(suggestion);
            }
        }
        pushAuditEntry({
            stage: "request",
            status: "success",
            message: "Agentic workflow completed",
            details: {
                stages: results.map((r) => r.stage),
                durationMs: Date.now() - startedAt,
            },
        });
        return results;
    }
    catch (error) {
        const message = handleError(error, "runAgentWorkflow");
        pushAuditEntry({
            stage: "error",
            status: "error",
            message: "Agentic workflow failed",
            details: { error: message },
        });
        throw error;
    }
}
function logAIAction(action, payload) {
    const timestamp = new Date().toISOString();
    console.log(`[AI Middleware] ${timestamp} | ${action}`, payload);
}
// Error handler
function handleError(error, context) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[AI Middleware Error] ${context}:`, msg);
    return msg;
}
function pushAuditEntry(entry) {
    const { addAuditEntry } = useAIStore.getState();
    addAuditEntry({
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        ...entry,
    });
}
// Retry logic
async function withRetry(fn, retries = 2) {
    let lastError;
    for (let i = 0; i <= retries; i++) {
        try {
            return await fn();
        }
        catch (err) {
            lastError = err;
            if (i < retries) {
                await new Promise((r) => setTimeout(r, 500 * (i + 1)));
            }
        }
    }
    throw lastError;
}
async function callChatEndpoint(messages, options = {}) {
    const payload = {
        context: options.context,
        model_name: options.modelName,
        messages,
    };
    const label = options.label || "chat";
    logAIAction(`${label}:request`, payload);
    const res = await withRetry(async () => {
        const response = await fetch(`${API_BASE}/book/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            throw new Error(`Chat API error: ${response.status}`);
        }
        return response.json();
    });
    logAIAction(`${label}:response`, res);
    return res;
}
// ========== API Calls ==========
export async function sendChatMessage(messages, options) {
    const llmMessages = messages.map((m) => ({
        role: m.role,
        content: m.text,
        tool_name: m.toolName,
    }));
    const res = await callChatEndpoint(llmMessages, {
        context: options?.context,
        modelName: options?.modelName,
        label: "sendChatMessage",
    });
    return res.message;
}
export async function runTool(tool, query, options) {
    logAIAction("runTool", { tool, query, options });
    const payload = {
        context_path: options?.contextPath,
        section_index: options?.sectionIndex,
        model_name: options?.modelName,
        tool,
        query,
    };
    const res = await withRetry(async () => {
        const response = await fetch(`${API_BASE}/tool/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            throw new Error(`Tool API error: ${response.status}`);
        }
        return response.json();
    });
    logAIAction("toolResponse", res);
    return res;
}
export async function generateImage(prompt, options) {
    logAIAction("generateImage", { prompt, options });
    const payload = {
        prompt,
        negative_prompt: options?.negativePrompt,
        width: options?.width || 1024,
        height: options?.height || 1024,
    };
    const res = await withRetry(async () => {
        const response = await fetch(`${API_BASE}/book/image/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            throw new Error(`Image generation API error: ${response.status}`);
        }
        return response.json();
    });
    logAIAction("generateImageResponse", res);
    return res;
}
export async function upscaleImage(imageUrl, upscaleFactor = 2) {
    logAIAction("upscaleImage", { imageUrl, upscaleFactor });
    const res = await withRetry(async () => {
        const response = await fetch(`${API_BASE}/book/image/upscale`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image_url: imageUrl, upscale_factor: upscaleFactor }),
        });
        if (!response.ok) {
            throw new Error(`Image upscale API error: ${response.status}`);
        }
        return response.json();
    });
    logAIAction("upscaleImageResponse", res);
    return res;
}
/**
 * Intelligent multi-source search using deep_router.
 * Aggregates results from Wikipedia, arXiv, Perplexity, and web search.
 */
export async function searchWeb(query, maxResults = 5) {
    logAIAction("searchWeb", { query, maxResults });
    const res = await withRetry(async () => {
        const response = await fetch(`${API_BASE}/book/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, max_results: maxResults }),
        });
        if (!response.ok) {
            throw new Error(`Search API error: ${response.status}`);
        }
        return response.json();
    });
    logAIAction("searchWebResponse", res);
    return res;
}
export async function requestSuggestion(instruction, options) {
    logAIAction("requestSuggestion", { instruction, options });
    const payload = {
        context: options?.context,
        model_name: options?.modelName,
        messages: [{ role: "user", content: instruction }],
    };
    const res = await withRetry(async () => {
        const response = await fetch(`${API_BASE}/book/suggest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            throw new Error(`Suggestion API error: ${response.status}`);
        }
        return response.json();
    });
    logAIAction("suggestionResponse", res);
    return res.body;
}
// ========== Simple suggestion cache ==========
const suggestionCache = new Map();
export function getCachedSuggestion(key) {
    return suggestionCache.get(key);
}
export function setCachedSuggestion(key, value) {
    suggestionCache.set(key, value);
}
export function clearSuggestionCache() {
    suggestionCache.clear();
}
// ========== Zustand integration helpers ==========
/**
 * High-level: Send a user message, call backend, update store.
 */
export async function handleUserMessage(text, options) {
    const { addMessage, setLoading, messages } = useAIStore.getState();
    const userMsg = {
        id: `${Date.now()}`,
        role: "user",
        text,
        timestamp: new Date().toISOString(),
    };
    addMessage(userMsg);
    setLoading(true);
    try {
        const allMessages = [...messages, userMsg];
        const reply = await sendChatMessage(allMessages, options);
        const assistantMsg = {
            id: `${Date.now() + 1}`,
            role: "assistant",
            text: reply,
            timestamp: new Date().toISOString(),
        };
        addMessage(assistantMsg);
    }
    catch (err) {
        handleError(err, "handleUserMessage");
        addMessage({
            id: `${Date.now() + 2}`,
            role: "assistant",
            text: "[Error: Unable to reach AI backend.]",
            timestamp: new Date().toISOString(),
        });
    }
    finally {
        setLoading(false);
    }
}
/**
 * High-level: Request a suggestion, update store.
 */
export async function handleSuggestionRequest(instruction, type = "rewrite", options) {
    const { addSuggestion, setLoading } = useAIStore.getState();
    setLoading(true);
    try {
        const results = await runAgentWorkflow(instruction, {
            context: options?.context,
            modelName: options?.modelName,
            chapterId: options?.chapterId,
        });
        const { addMessage } = useAIStore.getState();
        const editorIndex = results.findIndex((r) => r.stage === "editor");
        const editorResult = editorIndex >= 0 ? results[editorIndex] : undefined;
        if (editorResult && editorResult.text.trim().length > 0) {
            addMessage({
                id: `msg-editor-${Date.now()}`,
                role: "assistant",
                text: editorResult.text,
                timestamp: new Date().toISOString(),
                stage: "editor",
                metadata: {
                    stageOrder: editorIndex,
                    cached: editorResult.cached,
                },
            });
        }
    }
    catch (err) {
        handleError(err, "handleSuggestionRequest");
        // Fallback to single-shot suggestion if agent workflow fails
        try {
            const suggestionText = await requestSuggestion(instruction, options);
            const fallbackSuggestion = {
                id: `s-${Date.now()}`,
                type,
                text: suggestionText,
                chapterId: options?.chapterId,
                createdAt: new Date().toISOString(),
                notes: "Fallback single-shot suggestion",
            };
            addSuggestion(fallbackSuggestion);
            const { addMessage } = useAIStore.getState();
            if (suggestionText.trim().length > 0) {
                addMessage({
                    id: `msg-fallback-${Date.now()}`,
                    role: "assistant",
                    text: suggestionText,
                    timestamp: new Date().toISOString(),
                    stage: "editor",
                    metadata: { fallback: true },
                });
            }
            pushAuditEntry({
                stage: "error",
                status: "success",
                message: "Fallback suggestion provided after agent workflow failure",
            });
        }
        catch (fallbackError) {
            const message = handleError(fallbackError, "handleSuggestionRequest:fallback");
            pushAuditEntry({
                stage: "error",
                status: "error",
                message: "Fallback suggestion failed",
                details: { error: message },
            });
        }
    }
    finally {
        setLoading(false);
    }
}
/**
 * High-level: Run a tool, update store.
 */
export async function handleToolCall(tool, query, options) {
    const { addMessage, setLoading } = useAIStore.getState();
    setLoading(true);
    try {
        const result = await runTool(tool, query, options);
        const toolMsg = {
            id: `${Date.now()}`,
            role: "tool",
            text: result.content,
            toolName: result.tool_name,
            timestamp: new Date().toISOString(),
        };
        addMessage(toolMsg);
    }
    catch (err) {
        handleError(err, "handleToolCall");
        addMessage({
            id: `${Date.now() + 1}`,
            role: "tool",
            text: "[Error: Tool call failed.]",
            timestamp: new Date().toISOString(),
        });
    }
    finally {
        setLoading(false);
    }
}
