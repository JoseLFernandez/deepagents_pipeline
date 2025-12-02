"\"\"\"LLM registry for multi-provider experimentation and evaluation.\"\"\""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, Iterable, List, Optional

from langchain_core.language_models.chat_models import BaseChatModel

try:
    from langchain_openai import ChatOpenAI
except ImportError:  # pragma: no cover - optional dependency
    ChatOpenAI = None  # type: ignore

try:
    from langchain_ollama import ChatOllama
except ImportError:  # pragma: no cover - optional dependency
    ChatOllama = None  # type: ignore

from config import settings


ChatFactory = Callable[[], BaseChatModel]


@dataclass
class LLMProvider:
    """Metadata describing a chat model provider."""

    name: str
    description: str
    client_factory: ChatFactory
    family: str = "custom"
    supports_structured: bool = True


class LLMRegistry:
    """Simple registry that keeps track of all available chat models."""

    def __init__(self) -> None:
        self._providers: Dict[str, LLMProvider] = {}

    def register(self, provider: LLMProvider) -> None:
        key = provider.name.lower()
        self._providers[key] = provider

    def get(self, name: str) -> LLMProvider:
        provider = self._providers.get(name.lower())
        if not provider:
            raise KeyError(
                f"LLM provider '{name}' is not registered. "
                f"Known providers: {', '.join(self._providers)}"
            )
        return provider

    def get_chat_model(self, name: Optional[str] = None) -> BaseChatModel:
        provider_name = name or settings.default_model
        provider = self.get(provider_name)
        return provider.client_factory()

    def list_available(self) -> List[str]:
        return sorted(self._providers.keys())

    def evaluate_prompt(
        self,
        prompt: str,
        provider_names: Iterable[str],
        system_message: Optional[str] = None,
    ) -> Dict[str, str]:
        """Send the same prompt to multiple models and collect responses."""
        responses: Dict[str, str] = {}
        for name in provider_names:
            model = self.get_chat_model(name)
            messages = []
            if system_message:
                messages.append({"role": "system", "content": system_message})
            messages.append({"role": "user", "content": prompt})
            result = model.invoke(messages)
            responses[name] = getattr(result, "content", str(result))
        return responses


llm_registry = LLMRegistry()


def _register_default_llms() -> None:
    """Register built-in providers so the registry works out-of-the-box."""
    if ChatOllama is not None:
        llm_registry.register(
            LLMProvider(
                name="ollama:llama3",
                family="ollama",
                description="Local Ollama llama3 with deterministic sampling",
                client_factory=lambda: ChatOllama(model="llama3", temperature=0),
            )
        )
    if ChatOpenAI is not None:
        llm_registry.register(
            LLMProvider(
                name="openai:gpt-4o-mini",
                family="openai",
                description="OpenAI GPT-4o mini via langchain-openai client",
                client_factory=lambda: ChatOpenAI(
                    model="gpt-4o-mini",
                    temperature=0,
                ),
            )
        )
        llm_registry.register(
            LLMProvider(
                name="ollama:gpt-oss-proxy",
                family="custom",
                description="ChatOpenAI pointed at the local gpt-oss proxy (http://localhost:11434/v1)",
                client_factory=lambda: ChatOpenAI(
                    model="gpt-oss",
                    base_url="http://localhost:11434/v1",
                    temperature=0,
                    api_key=settings.openai_api_key or "dummy-key",
                ),
            )
        )
        llm_registry.register(
            LLMProvider(
                name="ollama:gpt-oss",
                family="ollama",
                description="Direct gpt-oss access via OpenAI-compatible endpoint exposed by Ollama",
                client_factory=lambda: ChatOpenAI(
                    model="gpt-oss",
                    base_url="http://localhost:11434/v1",
                    temperature=0,
                    api_key=settings.openai_api_key or "dummy-key",
                ),
            )
        )


_register_default_llms()
