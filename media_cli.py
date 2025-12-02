from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List

from media_agent import MediaGenerationAgent, MediaSpec, load_media_specs
from pipeline import slugify


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate visual assets (charts, diagrams, images, videos) via the MediaGenerationAgent."
    )
    parser.add_argument(
        "--spec",
        required=True,
        help="Path to a JSON specification file describing the assets to render.",
    )
    parser.add_argument(
        "--output-root",
        default="results",
        help="Base directory for generated artifacts (default: results).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate the specification without writing any files.",
    )
    return parser.parse_args()


def _load_specs(path: Path) -> Dict[str, Any]:
    data = load_media_specs(path)
    if "assets" not in data or not isinstance(data["assets"], list):
        raise ValueError("Specification must include an 'assets' array.")
    return data


def main() -> None:
    args = _parse_args()
    spec_path = Path(args.spec)
    data = _load_specs(spec_path)
    topic = data.get("topic", "media_assets")
    topic_slug = slugify(topic)
    output_root = Path(args.output_root)
    agent = MediaGenerationAgent(output_root=output_root)
    assets: List[Dict[str, Any]] = data["assets"]
    generated: List[str] = []
    for idx, asset_payload in enumerate(assets):
        spec = MediaSpec.from_dict(asset_payload)
        if args.dry_run:
            print(f"[DRY RUN] Would generate '{spec.filename}' ({spec.kind}) for topic '{topic_slug}'.")
            continue
        path = agent.generate(spec, topic_slug=topic_slug)
        generated.append(str(path))
        print(f"[OK] Generated {spec.kind} -> {path}")
    if not generated and not args.dry_run:
        print("No assets were generated.")


if __name__ == "__main__":
    main()
