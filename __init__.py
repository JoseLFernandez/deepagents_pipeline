"""
Modernized DeepAgents research pipeline package.

This package centralizes configuration, tool wiring, LLM selection, the
LangGraph research workflow, evaluation helpers, and an interactive chat
surface.  It is designed so that the legacy gpt_ollama scripts can import
the modular components while new code lives entirely under src/.
"""

from config import AppSettings, settings
from eval import ModelEvaluator
from llm import LLMRegistry, LLMProvider, llm_registry
from media_agent import MediaGenerationAgent, MediaSpec
from pipeline import ResearchPipeline

__all__ = [
    "AppSettings",
    "settings",
    "LLMRegistry",
    "LLMProvider",
    "llm_registry",
    "ResearchPipeline",
    "ModelEvaluator",
    "MediaGenerationAgent",
    "MediaSpec",
]
