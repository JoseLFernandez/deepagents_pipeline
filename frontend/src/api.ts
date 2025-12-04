import { SessionPayload, ChatMessagePayload } from "./types";

export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listTopics: () => request<{ topics: string[] }>("/topics"),
  resolveTopic: (topic: string) =>
    request<{ context_path: string; message: string }>("/topics/resolve", {
      method: "POST",
      body: JSON.stringify({ topic }),
    }),
  generateTopic: (topic: string, model_name?: string) =>
    request<{ context_path: string; message: string }>("/topics/generate", {
      method: "POST",
      body: JSON.stringify({ topic, model_name }),
    }),
  initSession: (payload: { context_path: string; model_name?: string; system_prompt?: string }) =>
    request<SessionPayload>("/session/init", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  saveSection: (payload: { context_path: string; section_index: number; new_body: string }) =>
    request("/section/save", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  sectionDiff: (payload: { context_path: string; section_index: number }) =>
    request<{ diff_html: string }>("/section/diff", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  renderSection: (body: string) =>
    request<{ html: string }>("/section/render", {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  llmRewrite: (payload: {
    section_index: number;
    instruction?: string;
    model_name?: string;
    context_path: string;
  }) =>
    request<{ body: string }>("/section/llm_rewrite", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  sectionChat: (payload: {
    context_path: string;
    section_index?: number;
    model_name?: string;
    messages: ChatMessagePayload[];
  }) =>
    request<{ message: string; chain_of_thought?: string[] }>("/section/chat", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  runTool: (payload: {
    context_path?: string;
    section_index?: number;
    model_name?: string;
    tool: string;
    query: string;
  }) =>
    request<{ tool_name: string; content: string; asset_path?: string; snippet?: string }>(
      "/section/tool",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),
  deepAgentEdit: (payload: {
    context_path: string;
    section_index: number;
    message: string;
    model_name?: string;
  }) =>
    request<{ message: string; html: string }>("/section/deepagent_edit", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  promote: (payload: { context_path: string; section_index: number }) =>
    request("/document/promote", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  regenerate: (payload: { topic: string; model_name?: string; system_prompt?: string }) =>
    request<SessionPayload & { context_path: string; message: string }>("/document/regenerate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
