"""Shared tool implementations for research agents."""

from __future__ import annotations

import re
from typing import Dict, List, Literal, Optional

import requests
from tavily import TavilyClient

from config import settings

tavily_client = TavilyClient(api_key=settings.tavily_api_key or "invalid")


def internet_search(
    query: str,
    max_results: int = 5,
    topic: str = "general",
    include_raw_content: bool = False,
) -> Dict:
    """Run a Tavily web search for the given query/topic."""
    allowed = {"general", "news", "finance"}
    normalized_topic = (topic or "general").strip().lower()
    if normalized_topic not in allowed:
        normalized_topic = "general"
    return tavily_client.search(
        query=query,
        max_results=max_results,
        topic=normalized_topic,
        include_raw_content=include_raw_content,
    )


def wikipedia_lookup(query: str) -> str:
    """Return the summary paragraph for a Wikipedia article."""
    url = (
        f"https://en.wikipedia.org/api/rest_v1/page/summary/"
        f"{query.replace(' ', '_')}"
    )
    resp = requests.get(url, timeout=20)
    if resp.status_code == 200:
        return resp.json().get("extract", "No summary found.")
    return f"Wikipedia lookup failed with status {resp.status_code}"


def arxiv_search(query: str, max_results: int = 3) -> str:
    """Return formatted arXiv title + URL pairs for the given query."""
    url = (
        f"http://export.arxiv.org/api/query?search_query=all:{query}"
        f"&start=0&max_results={max_results}"
    )
    resp = requests.get(url, timeout=20)
    if resp.status_code != 200:
        return "arXiv search failed."

    entries = resp.text.split("<entry>")[1:]
    results: List[str] = []
    for entry in entries:
        try:
            title = (
                entry.split("<title>")[1]
                .split("</title>")[0]
                .strip()
                .replace("\n", " ")
            )
            link = entry.split("<id>")[1].split("</id>")[0].strip()
            results.append(f"{title}\n{link}")
        except Exception:
            continue
    return "\n\n".join(results) if results else "No arXiv results."


def local_file_search(keyword: str, filename: str = "notes.txt") -> str:
    """Search for a keyword inside a local UTF-8 text file."""
    try:
        with open(filename, "r", encoding="utf-8") as handle:
            hits = [
                line.strip()
                for line in handle
                if keyword.lower() in line.lower()
            ]
    except OSError as exc:
        return f"Local file search failed: {exc}"
    return "\n".join(hits) if hits else f"No matches for '{keyword}'."


def deep_router(topic: str) -> Dict[str, List[str]]:
    """Plan which tools to use for a topic and explain the reasoning."""
    topic_lower = topic.lower()
    plan: List[str] = []
    tools_to_use: List[str] = []
    if any(key in topic_lower for key in ["research", "paper", "arxiv"]):
        plan.append("Use arxiv_search for academic papers.")
        tools_to_use.append("arxiv_search")
    if any(key in topic_lower for key in ["wikipedia", "overview", "history"]):
        plan.append("Use wikipedia_lookup for background.")
        tools_to_use.append("wikipedia_lookup")
    if any(key in topic_lower for key in ["local", "notes", "file"]):
        plan.append("Use local_file_search for on-disk artifacts.")
        tools_to_use.append("local_file_search")
    plan.append("Use internet_search for general web info.")
    tools_to_use.append("internet_search")
    return {"plan": plan, "tools": tools_to_use}


DEFAULT_TOOLS = [
    internet_search,
    deep_router,
    wikipedia_lookup,
    arxiv_search,
    local_file_search,
]
