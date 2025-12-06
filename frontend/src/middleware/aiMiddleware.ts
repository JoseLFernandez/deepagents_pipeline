/**
 * AI Middleware: Handles AI orchestration, logging, error handling, and caching.
 * Connects to the backend endpoints for chat, suggestions, and tool calls.
 */

import {
  useAIStore,
  ChatMessage,
  AISuggestion,
  AIMode,
  AIAgentStage,
  AIAuditEntry,
} from "../state";

const API_BASE = "http://localhost:8000";

// Types for backend requests/responses
interface ChatRequest {
  context?: string;
  model_name?: string;
  messages: { role: string; content: string; tool_name?: string }[];
}

interface ChatResponse {
  message: string;
}

interface ToolRequest {
  context_path?: string;
  section_index?: number;
  model_name?: string;
  tool: string;
  query: string;
}

interface ToolResponse {
  content: string;
  tool_name: string;
  asset_path?: string;
  snippet?: string;
}

interface SuggestionRequest {
  context_path?: string;
  section_index?: number;
  model_name?: string;
  instruction: string;
}

interface SuggestionResponse {
  body: string;
  message?: string;
}

type LLMMessage = {
  role: string;
  content: string;
  tool_name?: string;
};

interface ChatCallOptions {
  context?: string;
  modelName?: string;
  label?: string;
}

type StageCacheEntry = {
  stage: AIAgentStage;
  text: string;
  notes?: string;
  sourcePrompt: string;
  createdAt: number;
};

interface StageResult {
  stage: AIAgentStage;
  text: string;
  notes?: string;
  cached: boolean;
  prompt: string;
}

const AGENT_SYSTEM_PROMPTS: Record<AIAgentStage, string> = {
  generation:
    "You are the Generation Agent. Produce a high-quality draft that satisfies the user request. Focus on clarity, academic tone, and factual grounding. Return only the drafted prose without commentary.",
  reflection:
    "You are the Reflection Agent. Review the provided draft and list concrete improvements, missing citations, logical gaps, or stylistic issues. Respond with bullet points grouped by theme. Do not rewrite the draft.",
  critique:
    "You are the Critique Agent. Provide a peer-review style critique of the draft incorporating the reflection notes. Highlight redundancies, inconsistencies, and opportunities for strengthening the argument. Use numbered points.",
  editor:
    "You are the Editor Agent. Produce a polished final rewrite that incorporates the reflection findings and critique guidance. Maintain academic tone, add citations when needed, and ensure cohesive flow. Return the full rewritten text only.",
};

const AGENT_SEQUENCE: AIAgentStage[] = [
  "generation",
  "reflection",
  "critique",
  "editor",
];

const STAGE_CACHE_TTL = 1000 * 60 * 10; // 10 minutes
const stageCache = new Map<string, StageCacheEntry>();

function makeStageCacheKey(stage: AIAgentStage, prompt: string, context?: string): string {
  return JSON.stringify({ stage, prompt, context });
}

function getCachedStage(key: string): StageCacheEntry | undefined {
  const entry = stageCache.get(key);
  if (!entry) return undefined;
  const age = Date.now() - entry.createdAt;
  if (age > STAGE_CACHE_TTL) {
    stageCache.delete(key);
    return undefined;
  }
  return entry;
}

function setStageCache(key: string, value: StageCacheEntry): void {
  stageCache.set(key, value);
}

function buildStageUserPrompt(
  stage: AIAgentStage,
  userPrompt: string,
  context: string | undefined,
  priorResults: StageResult[]
): string {
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

async function executeAgentStage(
  stage: AIAgentStage,
  userPrompt: string,
  context: string | undefined,
  priorResults: StageResult[],
  options?: { modelName?: string }
): Promise<StageResult> {
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

  const messages: LLMMessage[] = [
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
    const result: StageResult = {
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
  } catch (error) {
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

const STAGE_NOTES: Record<AIAgentStage, string> = {
  generation: "Baseline draft generated for review.",
  reflection: "Issues and opportunities identified for improvement.",
  critique: "Critical feedback to address before final edit.",
  editor: "Final polished rewrite ready to insert.",
};

interface AgentWorkflowOptions {
  context?: string;
  modelName?: string;
  chapterId?: number;
}

async function runAgentWorkflow(
  instruction: string,
  options: AgentWorkflowOptions = {}
): Promise<StageResult[]> {
  const results: StageResult[] = [];
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
      const stageResult = await executeAgentStage(
        stage,
        instruction,
        options.context,
        results,
        { modelName: options.modelName }
      );
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

      const suggestion: AISuggestion = {
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
      } else {
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
  } catch (error) {
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
function logAIAction(action: string, payload: unknown) {
  const timestamp = new Date().toISOString();
  console.log(`[AI Middleware] ${timestamp} | ${action}`, payload);
}

// Error handler
function handleError(error: unknown, context: string): string {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[AI Middleware Error] ${context}:`, msg);
  return msg;
}

function pushAuditEntry(entry: Omit<AIAuditEntry, "id" | "timestamp">): void {
  const { addAuditEntry } = useAIStore.getState();
  addAuditEntry({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  });
}

// Retry logic
async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < retries) {
        await new Promise((r) => setTimeout(r, 500 * (i + 1)));
      }
    }
  }
  throw lastError;
}

async function callChatEndpoint(
  messages: LLMMessage[],
  options: ChatCallOptions = {}
): Promise<ChatResponse> {
  const payload: ChatRequest = {
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
    return response.json() as Promise<ChatResponse>;
  });
  logAIAction(`${label}:response`, res);
  return res;
}

// ========== API Calls ==========

export async function sendChatMessage(
  messages: ChatMessage[],
  options?: {
    context?: string;
    modelName?: string;
  }
): Promise<string> {
  const llmMessages: LLMMessage[] = messages.map((m) => ({
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

export async function runTool(
  tool: string,
  query: string,
  options?: {
    contextPath?: string;
    sectionIndex?: number;
    modelName?: string;
  }
): Promise<ToolResponse> {
  logAIAction("runTool", { tool, query, options });
  const payload: ToolRequest = {
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
    return response.json() as Promise<ToolResponse>;
  });
  logAIAction("toolResponse", res);
  return res;
}

// ========== Picsart Image Generation ==========

interface PicsartGenerateRequest {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
}

interface PicsartResponse {
  status: string;
  message: string;
  url: string;
  local_path: string;
}

export async function generateImage(
  prompt: string,
  options?: {
    negativePrompt?: string;
    width?: number;
    height?: number;
  }
): Promise<PicsartResponse> {
  logAIAction("generateImage", { prompt, options });
  const payload: PicsartGenerateRequest = {
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
    return response.json() as Promise<PicsartResponse>;
  });
  logAIAction("generateImageResponse", res);
  return res;
}

export async function upscaleImage(
  imageUrl: string,
  upscaleFactor: number = 2
): Promise<PicsartResponse> {
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
    return response.json() as Promise<PicsartResponse>;
  });
  logAIAction("upscaleImageResponse", res);
  return res;
}

interface SearchResultSource {
  source: string;
  content: string;
  citations?: string[];
  status: string;
}

interface DeepSearchResponse {
  status: string;
  query: string;
  plan: string[];
  tools_used: string[];
  results: Record<string, SearchResultSource>;
  summary: string;
  errors: string[] | null;
}

/**
 * Intelligent multi-source search using deep_router.
 * Aggregates results from Wikipedia, arXiv, Perplexity, and web search.
 */
export async function searchWeb(
  query: string,
  maxResults: number = 5
): Promise<DeepSearchResponse> {
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
    return response.json() as Promise<DeepSearchResponse>;
  });
  logAIAction("searchWebResponse", res);
  return res;
}

export async function requestSuggestion(
  instruction: string,
  options?: {
    context?: string;
    modelName?: string;
  }
): Promise<string> {
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
    return response.json() as Promise<SuggestionResponse>;
  });
  logAIAction("suggestionResponse", res);
  return res.body;
}

// ========== Simple suggestion cache ==========
const suggestionCache = new Map<string, string>();

export function getCachedSuggestion(key: string): string | undefined {
  return suggestionCache.get(key);
}

export function setCachedSuggestion(key: string, value: string): void {
  suggestionCache.set(key, value);
}

export function clearSuggestionCache(): void {
  suggestionCache.clear();
}

// ========== Zustand integration helpers ==========

/**
 * High-level: Send a user message, call backend, update store.
 */
export async function handleUserMessage(
  text: string,
  options?: {
    contextPath?: string;
    sectionIndex?: number;
    modelName?: string;
  }
): Promise<void> {
  const { addMessage, setLoading, messages } = useAIStore.getState();
  const userMsg: ChatMessage = {
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
    const assistantMsg: ChatMessage = {
      id: `${Date.now() + 1}`,
      role: "assistant",
      text: reply,
      timestamp: new Date().toISOString(),
    };
    addMessage(assistantMsg);
  } catch (err) {
    handleError(err, "handleUserMessage");
    addMessage({
      id: `${Date.now() + 2}`,
      role: "assistant",
      text: "[Error: Unable to reach AI backend.]",
      timestamp: new Date().toISOString(),
    });
  } finally {
    setLoading(false);
  }
}

/**
 * High-level: Request a suggestion, update store.
 */
export async function handleSuggestionRequest(
  instruction: string,
  type: AISuggestion["type"] = "rewrite",
  options?: {
    contextPath?: string;
    sectionIndex?: number;
    context?: string;
    modelName?: string;
    chapterId?: number;
  }
): Promise<void> {
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
  } catch (err) {
    handleError(err, "handleSuggestionRequest");
    // Fallback to single-shot suggestion if agent workflow fails
    try {
      const suggestionText = await requestSuggestion(instruction, options);
      const fallbackSuggestion: AISuggestion = {
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
    } catch (fallbackError) {
      const message = handleError(fallbackError, "handleSuggestionRequest:fallback");
      pushAuditEntry({
        stage: "error",
        status: "error",
        message: "Fallback suggestion failed",
        details: { error: message },
      });
    }
  } finally {
    setLoading(false);
  }
}

/**
 * High-level: Run a tool, update store.
 */
export async function handleToolCall(
  tool: string,
  query: string,
  options?: {
    contextPath?: string;
    sectionIndex?: number;
    modelName?: string;
  }
): Promise<void> {
  const { addMessage, setLoading } = useAIStore.getState();
  setLoading(true);
  try {
    const result = await runTool(tool, query, options);
    const toolMsg: ChatMessage = {
      id: `${Date.now()}`,
      role: "tool",
      text: result.content,
      toolName: result.tool_name,
      timestamp: new Date().toISOString(),
    };
    addMessage(toolMsg);
  } catch (err) {
    handleError(err, "handleToolCall");
    addMessage({
      id: `${Date.now() + 1}`,
      role: "tool",
      text: "[Error: Tool call failed.]",
      timestamp: new Date().toISOString(),
    });
  } finally {
    setLoading(false);
  }
}
