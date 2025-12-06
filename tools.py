"""Shared tool implementations for research agents."""

from __future__ import annotations

import os
import re
import uuid
from pathlib import Path
from typing import Dict, List, Literal, Optional

import requests
from tavily import TavilyClient

from config import settings

tavily_client = TavilyClient(api_key=settings.tavily_api_key or "invalid")

# Picsart API base URL
PICSART_API_BASE = "https://api.picsart.io/tools/1.0"

# Perplexity API base URL
PERPLEXITY_API_BASE = "https://api.perplexity.ai"


def perplexity_search(
    query: str,
    model: str = "llama-3.1-sonar-small-128k-online",
    max_tokens: int = 1024,
) -> Dict[str, str]:
    """
    Search the web using Perplexity AI with citations.
    
    Args:
        query: The search query or question
        model: Perplexity model to use (sonar models have web access)
        max_tokens: Maximum tokens in response
    
    Returns:
        Dict with 'answer', 'citations', and 'status'
    """
    api_key = settings.perplexity_api_key
    if not api_key:
        return {
            "status": "error",
            "answer": "PERPLEXITY_API_KEY not configured.",
            "citations": "",
        }
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    
    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful research assistant. Provide accurate, well-sourced answers with citations."
            },
            {
                "role": "user", 
                "content": query
            }
        ],
        "max_tokens": max_tokens,
        "temperature": 0.2,
        "return_citations": True,
    }
    
    try:
        response = requests.post(
            f"{PERPLEXITY_API_BASE}/chat/completions",
            headers=headers,
            json=payload,
            timeout=60,
        )
        
        if response.status_code == 200:
            result = response.json()
            answer = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            citations = result.get("citations", [])
            
            # Format citations
            citation_text = ""
            if citations:
                citation_text = "\n\nSources:\n" + "\n".join(
                    f"[{i+1}] {cite}" for i, cite in enumerate(citations)
                )
            
            return {
                "status": "success",
                "answer": answer,
                "citations": citation_text,
            }
        else:
            return {
                "status": "error",
                "answer": f"Perplexity API error: {response.status_code} - {response.text[:200]}",
                "citations": "",
            }
    except Exception as e:
        return {
            "status": "error",
            "answer": f"Perplexity request failed: {str(e)}",
            "citations": "",
        }


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
    if any(key in topic_lower for key in ["research", "paper", "arxiv", "academic", "study", "journal"]):
        plan.append("Use arxiv_search for academic papers.")
        tools_to_use.append("arxiv_search")
    if any(key in topic_lower for key in ["wikipedia", "overview", "history", "background", "definition", "what is"]):
        plan.append("Use wikipedia_lookup for background.")
        tools_to_use.append("wikipedia_lookup")
    if any(key in topic_lower for key in ["local", "notes", "file"]):
        plan.append("Use local_file_search for on-disk artifacts.")
        tools_to_use.append("local_file_search")
    if any(key in topic_lower for key in ["image", "picture", "illustration", "photo", "visual"]):
        plan.append("Use picsart_generate for AI-generated images.")
        tools_to_use.append("picsart_generate")
    if any(key in topic_lower for key in ["latest", "current", "news", "recent", "today", "2024", "2025"]):
        plan.append("Use perplexity_search for AI-powered web search with citations.")
        tools_to_use.append("perplexity_search")
    # Default: always include internet search for general info
    plan.append("Use internet_search for general web info.")
    tools_to_use.append("internet_search")
    return {"plan": plan, "tools": tools_to_use}


def deep_search(query: str, max_results: int = 5) -> Dict[str, Any]:
    """
    Intelligent multi-source search using deep_router to decide which tools to use.
    Aggregates results from Wikipedia, arXiv, Perplexity, and web search based on query context.
    
    Args:
        query: The search query
        max_results: Maximum results per source
    
    Returns:
        Dict with 'plan', 'results' (per-source), and 'summary'
    """
    # Get the routing plan
    routing = deep_router(query)
    plan = routing["plan"]
    tools = routing["tools"]
    
    results: Dict[str, Any] = {}
    errors: List[str] = []
    
    # Execute each tool in the plan
    for tool_name in tools:
        try:
            if tool_name == "wikipedia_lookup":
                wiki_result = wikipedia_lookup(query)
                results["wikipedia"] = {
                    "source": "Wikipedia",
                    "content": wiki_result,
                    "status": "success" if "not found" not in wiki_result.lower() else "no_results"
                }
            
            elif tool_name == "arxiv_search":
                arxiv_result = arxiv_search(query, max_results=max_results)
                results["arxiv"] = {
                    "source": "arXiv",
                    "content": arxiv_result,
                    "status": "success" if "No arXiv results" not in arxiv_result else "no_results"
                }
            
            elif tool_name == "perplexity_search":
                perplexity_result = perplexity_search(query)
                results["perplexity"] = {
                    "source": "Perplexity AI",
                    "content": perplexity_result.get("answer", ""),
                    "citations": perplexity_result.get("citations", []),
                    "status": perplexity_result.get("status", "error")
                }
            
            elif tool_name == "internet_search":
                web_result = internet_search(query)
                results["web"] = {
                    "source": "Web Search",
                    "content": web_result,
                    "status": "success" if web_result else "no_results"
                }
            
            elif tool_name == "local_file_search":
                local_result = local_file_search(query)
                results["local"] = {
                    "source": "Local Files",
                    "content": local_result,
                    "status": "success" if "No matches" not in local_result else "no_results"
                }
                
        except Exception as e:
            errors.append(f"{tool_name}: {str(e)}")
            results[tool_name] = {
                "source": tool_name,
                "content": f"Error: {str(e)}",
                "status": "error"
            }
    
    # Build a combined summary
    summary_parts = []
    for source, data in results.items():
        if data.get("status") == "success" and data.get("content"):
            content = data["content"]
            # Truncate long content for summary
            if len(content) > 500:
                content = content[:500] + "..."
            summary_parts.append(f"**{data['source']}:**\n{content}")
    
    return {
        "status": "success",
        "query": query,
        "plan": plan,
        "tools_used": tools,
        "results": results,
        "summary": "\n\n---\n\n".join(summary_parts) if summary_parts else "No results found.",
        "errors": errors if errors else None
    }


def picsart_generate(
    prompt: str,
    output_dir: str = "results/images",
    negative_prompt: str = "",
    width: int = 1024,
    height: int = 1024,
) -> Dict[str, str]:
    """
    Generate an AI image using Picsart's text-to-image API.
    
    Args:
        prompt: Text description of the image to generate
        output_dir: Directory to save the generated image
        negative_prompt: Things to avoid in the image
        width: Image width (default 1024)
        height: Image height (default 1024)
    
    Returns:
        Dict with 'url' (Picsart URL), 'local_path' (saved file), and 'status'
    """
    api_key = settings.picsart_api_key
    if not api_key:
        return {
            "status": "error",
            "message": "PICSART_API_KEY not configured. Add it to your .env file.",
            "url": "",
            "local_path": "",
        }
    
    headers = {
        "X-Picsart-API-Key": api_key,
        "Accept": "application/json",
    }
    
    # Use Picsart's text-to-image endpoint
    url = f"{PICSART_API_BASE}/text2image"
    
    data = {
        "prompt": prompt,
        "negative_prompt": negative_prompt or "blurry, low quality, distorted",
        "width": width,
        "height": height,
        "count": 1,
    }
    
    try:
        response = requests.post(url, headers=headers, data=data, timeout=60)
        
        if response.status_code == 200:
            result = response.json()
            image_url = result.get("data", [{}])[0].get("url", "")
            
            if image_url:
                # Download and save locally
                Path(output_dir).mkdir(parents=True, exist_ok=True)
                filename = f"picsart_{uuid.uuid4().hex[:8]}.png"
                local_path = Path(output_dir) / filename
                
                img_response = requests.get(image_url, timeout=30)
                if img_response.status_code == 200:
                    with open(local_path, "wb") as f:
                        f.write(img_response.content)
                    
                    return {
                        "status": "success",
                        "url": image_url,
                        "local_path": str(local_path),
                        "message": f"Image generated and saved to {local_path}",
                    }
            
            return {
                "status": "error",
                "message": "No image URL in response",
                "url": "",
                "local_path": "",
            }
        else:
            return {
                "status": "error",
                "message": f"Picsart API error: {response.status_code} - {response.text[:200]}",
                "url": "",
                "local_path": "",
            }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Picsart request failed: {str(e)}",
            "url": "",
            "local_path": "",
        }


def picsart_upscale(
    image_path: str,
    upscale_factor: int = 2,
    output_dir: str = "results/images",
) -> Dict[str, str]:
    """
    Upscale an image using Picsart's upscale API.
    
    Args:
        image_path: Path to the image to upscale
        upscale_factor: How much to upscale (2, 4, 6, 8)
        output_dir: Directory to save the upscaled image
    
    Returns:
        Dict with 'url', 'local_path', and 'status'
    """
    api_key = settings.picsart_api_key
    if not api_key:
        return {
            "status": "error",
            "message": "PICSART_API_KEY not configured.",
            "url": "",
            "local_path": "",
        }
    
    headers = {
        "X-Picsart-API-Key": api_key,
        "Accept": "application/json",
    }
    
    url = f"{PICSART_API_BASE}/upscale"
    
    try:
        with open(image_path, "rb") as f:
            files = {"image": f}
            data = {"upscale_factor": str(upscale_factor)}
            response = requests.post(url, headers=headers, files=files, data=data, timeout=60)
        
        if response.status_code == 200:
            result = response.json()
            image_url = result.get("data", {}).get("url", "")
            
            if image_url:
                Path(output_dir).mkdir(parents=True, exist_ok=True)
                filename = f"upscaled_{uuid.uuid4().hex[:8]}.png"
                local_path = Path(output_dir) / filename
                
                img_response = requests.get(image_url, timeout=30)
                if img_response.status_code == 200:
                    with open(local_path, "wb") as f:
                        f.write(img_response.content)
                    
                    return {
                        "status": "success",
                        "url": image_url,
                        "local_path": str(local_path),
                        "message": f"Image upscaled and saved to {local_path}",
                    }
            
            return {"status": "error", "message": "No URL in response", "url": "", "local_path": ""}
        else:
            return {"status": "error", "message": f"API error: {response.status_code}", "url": "", "local_path": ""}
    except Exception as e:
        return {"status": "error", "message": str(e), "url": "", "local_path": ""}


def picsart_remove_background(
    image_path: str,
    output_dir: str = "results/images",
) -> Dict[str, str]:
    """Remove background from an image using Picsart API."""
    api_key = settings.picsart_api_key
    if not api_key:
        return {"status": "error", "message": "PICSART_API_KEY not configured.", "url": "", "local_path": ""}
    
    headers = {
        "X-Picsart-API-Key": api_key,
        "Accept": "application/json",
    }
    
    url = f"{PICSART_API_BASE}/removebg"
    
    try:
        with open(image_path, "rb") as f:
            files = {"image": f}
            response = requests.post(url, headers=headers, files=files, timeout=60)
        
        if response.status_code == 200:
            result = response.json()
            image_url = result.get("data", {}).get("url", "")
            
            if image_url:
                Path(output_dir).mkdir(parents=True, exist_ok=True)
                filename = f"nobg_{uuid.uuid4().hex[:8]}.png"
                local_path = Path(output_dir) / filename
                
                img_response = requests.get(image_url, timeout=30)
                if img_response.status_code == 200:
                    with open(local_path, "wb") as f:
                        f.write(img_response.content)
                    
                    return {
                        "status": "success",
                        "url": image_url,
                        "local_path": str(local_path),
                        "message": f"Background removed, saved to {local_path}",
                    }
            
            return {"status": "error", "message": "No URL in response", "url": "", "local_path": ""}
        else:
            return {"status": "error", "message": f"API error: {response.status_code}", "url": "", "local_path": ""}
    except Exception as e:
        return {"status": "error", "message": str(e), "url": "", "local_path": ""}


DEFAULT_TOOLS = [
    internet_search,
    deep_router,
    deep_search,
    wikipedia_lookup,
    arxiv_search,
    local_file_search,
    perplexity_search,
    picsart_generate,
    picsart_upscale,
    picsart_remove_background,
]
