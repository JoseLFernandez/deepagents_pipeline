export type Section = {
  index: number;
  title: string;
  body: string;
  html: string;
};

export type SessionPayload = {
  context_path: string;
  model_name?: string;
  system_prompt?: string;
  sections_html: string;
  original_html: string;
  sections: Section[];
  original_sections: Section[];
  diff_html: string;
  working_versions?: { name: string; timestamp: string }[];
  original_versions?: { name: string; timestamp: string }[];
};

export type ChatMessagePayload = {
  role: "user" | "assistant" | "tool";
  content: string;
  tool_name?: string;
};
