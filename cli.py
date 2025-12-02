
from __future__ import annotations
import sys
try:
    from colorama import init as colorama_init, Fore, Style
    colorama_init()
except ImportError:
    class Dummy:
        RESET = RESET_ALL = BRIGHT = ""
        RED = GREEN = YELLOW = CYAN = MAGENTA = BLUE = WHITE = ""

    Fore = Style = Dummy()
"""
Command-line entry points for the DeepAgents research pipeline.

Example usage:

    PYTHONPATH=src python -m deepagents_pipeline.cli \
        --topic "DeepAgent peer papers" \
        --llm ollama:gpt-oss \
        --workdir results
"""

import argparse
import json
from pathlib import Path
from typing import Optional

from pipeline import ResearchPipeline


def _positive_path(value: str) -> Path:
    path = Path(value).expanduser()
    if not path.exists():
        path.mkdir(parents=True, exist_ok=True)
    return path


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run the DeepAgents research pipeline with a selected LLM.",
    )
    parser.add_argument(
        "--topic",
        required=True,
        help="Topic for the research handout.",
    )
    parser.add_argument(
        "--llm",
        default=None,
        help="LLM name registered in LLMRegistry (default from config).",
    )
    parser.add_argument(
        "--workdir",
        default="topics",
        type=_positive_path,
        help="Base directory where topic folders and all generated content will be written (default: topics).",
    )
    parser.add_argument(
        "--no-pdf",
        action="store_true",
        help="Skip the pdflatex compilation step.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit the pipeline result as JSON to stdout after completion.",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug output for troubleshooting.",
    )
    return parser


def run_research_from_args(args: argparse.Namespace):
    pipeline = ResearchPipeline(llm_name=args.llm, debug=args.debug)
    result = pipeline.run(
        topic=args.topic,
        llm_name=args.llm,
        compile_pdf=not args.no_pdf,
        workdir=str(args.workdir),
        debug=args.debug,
    )
    print(f"\n{Style.BRIGHT}{Fore.GREEN}=== PIPELINE COMPLETE ==={Style.RESET_ALL}")
    print(f"{Fore.CYAN}Topic:{Style.RESET_ALL} {result.topic}")
    print(f"{Fore.CYAN}Model:{Style.RESET_ALL} {result.model_name}")
    print(f"{Fore.CYAN}LaTeX:{Style.RESET_ALL} {result.tex_path}")
    print(f"{Fore.CYAN}PDF:  {Style.RESET_ALL}{result.pdf_path or 'not generated'}")
    if args.debug:
        print(f"\n{Fore.YELLOW}{Style.BRIGHT}--- AGENT EXECUTION TRACE ---{Style.RESET_ALL}")
        for i, msg in enumerate(result.messages):
            role = msg.get('role', 'system') if isinstance(msg, dict) else getattr(msg, 'role', 'system')
            content = msg.get('content', '') if isinstance(msg, dict) else getattr(msg, 'content', '')
            color = Fore.MAGENTA if role == 'user' else (Fore.BLUE if role == 'assistant' else Fore.WHITE)
            print(f"{color}[{role.upper()}]{Style.RESET_ALL} {content[:300]}{'...' if len(content) > 300 else ''}")
        print(f"\n{Fore.YELLOW}{Style.BRIGHT}--- END OF TRACE ---{Style.RESET_ALL}")
        print(f"\n{Fore.GREEN}Full LaTeX body written to:{Style.RESET_ALL} {result.tex_path}")
    if args.json:
        payload = {
            "topic": result.topic,
            "model": result.model_name,
            "latex_body_chars": len(result.latex_body),
            "tex_path": result.tex_path,
            "pdf_path": result.pdf_path,
        }
        print(json.dumps(payload, indent=2))
    return result


def main(argv: Optional[list[str]] = None):
    parser = _build_parser()
    args = parser.parse_args(argv)
    run_research_from_args(args)


if __name__ == "__main__":
    main()
