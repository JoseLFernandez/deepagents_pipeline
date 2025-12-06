"""Central configuration helpers for the DeepAgents pipeline."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional dependency
    def load_dotenv(*args, **kwargs):
        return None


_PACKAGE_ROOT = Path(__file__).resolve().parent

# Load environment variables in priority order:
# 1. default dotenv discovery (current working directory)
# 2. package-local .env (src/deepagents_pipeline/.env)
load_dotenv()
load_dotenv(_PACKAGE_ROOT / ".env", override=False)


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default)


@dataclass
class AppSettings:
    """Container for environment-driven settings."""

    tavily_api_key: str = field(default_factory=lambda: _env("TAVILY_API_KEY"))
    openai_api_key: str = field(default_factory=lambda: _env("OPENAI_API_KEY"))
    groq_api_key: str = field(default_factory=lambda: _env("GROQ_API_KEY"))
    perplexity_api_key: str = field(
        default_factory=lambda: _env("PERPLEXITY_API_KEY")
    )
    serper_api_key: str = field(default_factory=lambda: _env("SERPER_API_KEY"))
    github_token: str = field(default_factory=lambda: _env("GITHUB_CLI_TOKEN"))
    picsart_api_key: str = field(default_factory=lambda: _env("PICSART_API_KEY"))
    default_model: str = field(
        default_factory=lambda: _env("DEEPAGENT_DEFAULT_MODEL", "ollama:llama3")
    )

    extra: Dict[str, str] = field(default_factory=dict)

    def ensure(self) -> None:
        """Raise if required keys are missing to catch misconfiguration early."""
        missing = []
        if not self.tavily_api_key:
            missing.append("TAVILY_API_KEY")
        if missing:
            raise RuntimeError(
                "Missing environment variables: " + ", ".join(missing)
            )


settings = AppSettings()
settings.extra["debug"] = _env("DEEPAGENT_DEBUG", "0")
