export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
async function request(path, options) {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });
    if (!res.ok) {
        const message = await res.text();
        throw new Error(message || res.statusText);
    }
    return res.json();
}
export const api = {
    listTopics: () => request("/topics"),
    resolveTopic: (topic) => request("/topics/resolve", {
        method: "POST",
        body: JSON.stringify({ topic }),
    }),
    generateTopic: (topic, model_name) => request("/topics/generate", {
        method: "POST",
        body: JSON.stringify({ topic, model_name }),
    }),
    initSession: (payload) => request("/session/init", {
        method: "POST",
        body: JSON.stringify(payload),
    }),
    saveSection: (payload) => request("/section/save", {
        method: "POST",
        body: JSON.stringify(payload),
    }),
    sectionDiff: (payload) => request("/section/diff", {
        method: "POST",
        body: JSON.stringify(payload),
    }),
    renderSection: (body) => request("/section/render", {
        method: "POST",
        body: JSON.stringify({ body }),
    }),
    llmRewrite: (payload) => request("/section/llm_rewrite", {
        method: "POST",
        body: JSON.stringify(payload),
    }),
    sectionChat: (payload) => request("/section/chat", {
        method: "POST",
        body: JSON.stringify(payload),
    }),
    runTool: (payload) => request("/section/tool", {
        method: "POST",
        body: JSON.stringify(payload),
    }),
    deepAgentEdit: (payload) => request("/section/deepagent_edit", {
        method: "POST",
        body: JSON.stringify(payload),
    }),
    promote: (payload) => request("/document/promote", {
        method: "POST",
        body: JSON.stringify(payload),
    }),
    regenerate: (payload) => request("/document/regenerate", {
        method: "POST",
        body: JSON.stringify(payload),
    }),
};
