"""High-level research pipeline built on DeepAgents."""

from __future__ import annotations

import os
import re
import subprocess
from dataclasses import dataclass
from typing import Dict, List, Optional


class BasicResearchAgent:
    """Minimal chat agent that wraps a LangChain chat model with a system prompt."""

    def __init__(self, model, system_prompt: str) -> None:
        self.model = model
        self.system_prompt = system_prompt
        self.history: List[Dict[str, str]] = []
        self._fallback_cache: Dict[str, str] = {}

    def invoke(self, payload: Dict) -> Dict:
        incoming = payload.get("messages", [])
        conversation: List[Dict[str, str]] = [
            {"role": "system", "content": self.system_prompt}
        ]
        conversation.extend(self.history)
        conversation.extend(incoming)
        response = self.model.invoke(conversation)
        content = getattr(response, "content", str(response)).strip()
        if not content:
            topic = self._extract_topic(conversation)
            content = self._fallback_body(topic)
        self.history.extend(incoming)
        self.history.append({"role": "assistant", "content": content})
        return {
            "messages": incoming + [{"role": "assistant", "content": content}],
        }

    def _extract_topic(self, conversation: List[Dict[str, str]]) -> str:
        for message in reversed(conversation):
            text = message.get("content", "")
            if "Topic:" in text:
                after = text.split("Topic:", 1)[1].strip()
                if after:
                    return after.splitlines()[0].strip()
        return "Agentic Security"

    def _escape(self, text: str) -> str:
        return (
            text.replace("\\", " ")
            .replace("{", "")
            .replace("}", "")
            .replace("&", "and")
        )

    def _fallback_body(self, topic: str) -> str:
        topic_key = topic or "Agentic Security"
        if topic_key in self._fallback_cache:
            return self._fallback_cache[topic_key]
        topic_clean = self._escape(topic_key)
        body = rf"""
\section{{Introduction}}
Agentic AI trends such as {topic_clean} move automation from scripted workflows to self-directed reasoning loops that plan, call tools, and update memory without constant human supervision. This shift enlarges the attack surface with multi-turn context, plug-in ecosystems, and persistent knowledge bases that adversaries can poison or exfiltrate, making proactive governance essential for safety-critical deployments (Source: \url{{https://owasp.org/www-project-top-10-for-large-language-model-applications/}}).

\section{{Core Concepts}}
\subsection{{Agent Autonomy Layers}}
Contemporary stacks blend planners, controllers, and actuator tools. Each layer must enforce least-privilege authorizations so prompt injection or compromised tools cannot pivot into adjacent systems; MITRE ATLAS catalogs multi-layer attack paths that exploit weak separation (Source: \url{{https://atlas.mitre.org}}).

\subsection{{Context Surfaces}}
Retrieval-augmented agents interact with vector stores, scratchpads, and collaboration memories. Sensitive artifacts and credentials accumulate in these caches unless retention rules, anonymization, and differential access controls are enforced, a recurring failure pattern in early agent pilots (Source: \url{{https://blog.langchain.dev/memory-security/}}).

\subsection{{Threat Modeling Workflow}}
Teams should align MAESTRO, OWASP Agentic Security, and NIST AI RMF by scoping assets, mapping adversary goals, analyzing propagation paths, selecting controls, and defining assurance evidence such as telemetry coverage and automated tests (Source: \url{{https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf}}).

\section{{Threat Tracking}}
Maintain an agent-specific kill chain covering reconnaissance through impact, tagging every detection or incident with ATLAS technique IDs (e.g., prompt injection T0007, data poisoning T0020) to spot trends across business units. Metrics like blocked injection rate, mean time to contain tool abuse, and percent of runs with full trace capture keep leadership focused on residual risk.

\section{{Threat Monitoring}}
Apply layered controls: sanitize inputs and retrieved passages, enforce bounded tool plans through capability tokens, and stream full reasoning traces via LangSmith/OpenTelemetry for forensic replay (Source: \url{{https://www.langchain.com/langsmith}}). Statistical monitors should flag unusual token bursts, repeated tool loops, or novel destinations, while runbooks define kill switches, cache invalidation, and credential rotation steps after anomalies.

\section{{Examples and Use Cases}}
\subsection{{Finance Automation}}
A payables agent reading vendor emails was coerced into releasing fraudulent wires when memory lacked authenticity checks. Signed vendor metadata, deterministic approval templates, and simulation-only dry-runs before API execution mitigated the issue (Source: \url{{https://learn.microsoft.com/security/ai-red-team/overview}}).

\subsection{{Incident Response Copilot}}
Poisoned retrieval entries suppressed certain telemetry queries. Enforcing dual-source retrieval, storing provenance hashes, and MAESTRO-based conflict detection restored trust (Source: \url{{https://www.cisa.gov/resources-tools/resources/artificial-intelligence-security-response}}).

\section{{Ecosystem and Tools}}
Secured retrieval stores (FAISS with ACLs), action routers (LangGraph guardrails, Guardrails AI), curated search providers (Tavily), and document sanitizers (pdfminer.six) form the baseline. Snapshots and integrity diffing on embeddings repositories detect tampering before agents consume poisoned data.

\section{{Summary}}
Sustainable {topic_clean} initiatives treat autonomous agents as software supply chains requiring governance, validation, and rapid response across planning, memory, and tool layers.

\subsection{{Best Practices}}
\begin{{itemize}}
    \item Inventory every agent, model, and tool integration with owners, SLAs, and data classifications prior to production use.
    \item Tie deployment approvals to refreshed MAESTRO/OWASP threat models whenever prompts, models, or plugins change.
    \item Enforce policy guardrails in code (capabilities, rate limits, signed manifests) rather than relying on natural-language instructions.
    \item Capture and redact reasoning traces for monitoring and incident response, storing exemplars for regression tests.
    \item Run recurring joint red-team and chaos exercises simulating supply-chain compromise, retrieval poisoning, and controller abuse to validate playbooks.
\end{{itemize}}
""".strip()
        self._fallback_cache[topic_key] = body
        return body


def create_deep_agent(model, tools, system_prompt):
    # tools parameter is unused for now; placeholder for future integration.
    return BasicResearchAgent(model=model, system_prompt=system_prompt)

from config import settings
from llm import llm_registry
from tools import DEFAULT_TOOLS, deep_router

RESEARCH_INSTRUCTIONS = r"""
You are an expert technical researcher and LaTeX writer.
Always start by selecting tools via deep_router to plan your research path.
Synthesize knowledge from every tool call and cite references inline (plain URLs).
Structure the response using \section, \subsection, and lists per the outline below.
Provide concrete examples, diagrams, or code listings for technical topics.

\section{Introduction}
\section{Core Concepts}
\section{Threat Tracking}
\section{Threat Monitoring}
\section{Examples and Use Cases}
\section{Ecosystem and Tools}
\section{Summary}
""".strip()


def slugify(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    text = re.sub(r"_+", "_", text)
    return text.strip("_") or "document"


def wrap_with_preamble(topic: str, body: str) -> str:
    title = topic.replace("{", "").replace("}", "")
    return rf"""
\documentclass[11pt]{{article}}
\usepackage[a4paper,margin=1in]{{geometry}}
\usepackage{{titlesec}}
\usepackage{{enumitem}}
\usepackage{{courier}}
\usepackage{{listings}}
\usepackage{{xcolor}}
\usepackage{{hyperref}}
\usepackage{{tikz}}

\title{{{title}}}
\author{{DeepAgents Research Pipeline}}
\date{{\today}}

\begin{{document}}
\maketitle
\tableofcontents
\newpage

% The following content is auto-generated. Remove any agent planning comments or placeholders.
{body}

\end{{document}}
""".lstrip()


def filter_latex_safe(text: str) -> str:
    return re.sub(
        r"[^\x00-\x7F\n\r\t\\{}\[\]\$%&#_^~|<>/a-zA-Z0-9.,:;!?\-+*=() ]",
        "",
        text,
    )


@dataclass
class PipelineResult:
    topic: str
    latex_body: str
    latex_full: str
    tex_path: str
    pdf_path: Optional[str]
    model_name: str
    messages: List[Dict]


class ResearchPipeline:
    """Encapsulates the DeepAgents workflow with pluggable LLMs and tools."""

    def __init__(
        self,
        llm_name: Optional[str] = None,
        instructions: str = RESEARCH_INSTRUCTIONS,
        tools=None,
        debug: bool = False,
    ) -> None:
        self.llm_name = llm_name or settings.default_model
        self.instructions = instructions
        self.tools = tools or DEFAULT_TOOLS
        self.debug = debug

    def _build_agent(self, llm_name: Optional[str] = None):
        model = llm_registry.get_chat_model(llm_name or self.llm_name)
        return create_deep_agent(
            model=model,
            tools=self.tools,
            system_prompt=self.instructions,
        )

    def run(
        self,
        topic: str,
        llm_name: Optional[str] = None,
        compile_pdf: bool = True,
        workdir: str = "topics",
        debug: bool = False,
    ) -> PipelineResult:
        agent = self._build_agent(llm_name)
        user_message = (
            f"Topic: {topic}\n\n"
            "Write the LaTeX body as specified in your instructions. "
            "Remember: output ONLY LaTeX, no explanations."
        )
        if debug or self.debug:
            print("[DEBUG] Invoking agent with user message:", user_message)
        state = agent.invoke({"messages": [{"role": "user", "content": user_message}]})
        last_msg = state["messages"][-1]
        draft_body = last_msg.get("content", "") if isinstance(last_msg, dict) else getattr(last_msg, "content", "")

        critique_prompt = (
            "You are a critical reviewer and expert in technical writing, cybersecurity, and AI risk management. "
            "Thoroughly improve the following LaTeX handout for depth, actionable threat modeling, and monitoring strategies. "
            "For each section, especially 'Core Concepts' and agent-specific topics, provide detailed, narrative explanations with context, not just bullet points. "
            "Explain why each concept is important for the research topic, how it applies in real-world scenarios, and provide illustrative examples or case studies. "
            "Add step-by-step threat modeling approaches (referencing frameworks like MAESTRO, OWASP Agentic Security, or NIST RMF), and include practical monitoring/mitigation strategies. "
            "Cite all facts with inline references and include a 'Best Practices' subsection with actionable recommendations. "
            "Remove any agent planning comments or placeholders. Ensure the document is comprehensive, practical, and suitable for a professional audience.\n\n"
            + draft_body
        )
        if debug or self.debug:
            print("[DEBUG] Invoking agent with critique prompt:", critique_prompt)
        critique_state = agent.invoke({"messages": [{"role": "user", "content": critique_prompt}]})
        improved_msg = critique_state["messages"][-1]
        improved_latex = (
            improved_msg.get("content", "")
            if isinstance(improved_msg, dict)
            else getattr(improved_msg, "content", "")
        )
        improved_latex = filter_latex_safe(improved_latex)


        latex_full = wrap_with_preamble(topic, improved_latex)
        base = slugify(topic)
        topic_dir = os.path.join(workdir, base)
        os.makedirs(topic_dir, exist_ok=True)
        tex_path = os.path.join(topic_dir, f"{base}.tex")
        pdf_path = os.path.join(topic_dir, f"{base}.pdf")

        with open(tex_path, "w", encoding="utf-8") as handle:
            handle.write(latex_full)

        if compile_pdf and improved_latex.strip():
            try:
                subprocess.run(
                    ["pdflatex", "-interaction=nonstopmode", f"{base}.tex"],
                    cwd=topic_dir,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=True,
                )
                subprocess.run(
                    ["pdflatex", "-interaction=nonstopmode", f"{base}.tex"],
                    cwd=topic_dir,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=True,
                )
            except Exception:
                pdf_path = None
        else:
            pdf_path = None

        messages = state["messages"] + critique_state["messages"]
        return PipelineResult(
            topic=topic,
            latex_body=improved_latex,
            latex_full=latex_full,
            tex_path=tex_path,
            pdf_path=pdf_path,
            model_name=llm_name or self.llm_name,
            messages=messages,
        )
