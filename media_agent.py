"""Utility agent that generates charts, diagrams, images, or lightweight videos."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Union

import numpy as np

try:  # Optional dependency for charts/diagrams
    import matplotlib

    matplotlib.use("Agg")  # headless backend avoids GUI/thread requirements
    import matplotlib.pyplot as plt
except Exception:  # pragma: no cover - optional dependency
    plt = None  # type: ignore

try:  # Optional dependency for image/video generation
    from PIL import Image, ImageDraw, ImageFont
except Exception:  # pragma: no cover - optional dependency
    Image = ImageDraw = ImageFont = None  # type: ignore

try:  # Optional dependency for GIF/video stitching
    import imageio.v2 as imageio
except Exception:  # pragma: no cover - optional dependency
    imageio = None  # type: ignore


Palette = Sequence[str]


@dataclass
class MediaSpec:
    """Declarative description of a single visual asset."""

    kind: str
    filename: str
    title: str = ""
    description: str = ""
    chart_kind: str = "line"
    x_labels: Sequence[str] = field(default_factory=list)
    series: Sequence[Dict[str, Sequence[float]]] = field(default_factory=list)
    nodes: Sequence[str] = field(default_factory=list)
    edges: Sequence[Sequence[str]] = field(default_factory=list)
    text: str = ""
    diagram_direction: str = "TD"
    width: int = 1280
    height: int = 720
    frames: int = 12
    fps: int = 6
    palette: Palette = field(
        default_factory=lambda: ["#2563eb", "#dc2626", "#16a34a", "#f97316"]
    )

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> "MediaSpec":
        """Create a MediaSpec from a plain dictionary."""
        return cls(
            kind=payload["kind"],
            filename=payload["filename"],
            title=payload.get("title", ""),
            description=payload.get("description", ""),
            chart_kind=payload.get("chart_kind", "line"),
            x_labels=payload.get("x_labels", []) or [],
            series=payload.get("series", []) or [],
            nodes=payload.get("nodes", []) or [],
            edges=payload.get("edges", []) or [],
            text=payload.get("text", ""),
            diagram_direction=payload.get("diagram_direction", "TD"),
            width=int(payload.get("width", 1280)),
            height=int(payload.get("height", 720)),
            frames=int(payload.get("frames", 12)),
            fps=int(payload.get("fps", 6)),
            palette=payload.get("palette", None)
            or ["#2563eb", "#dc2626", "#16a34a", "#f97316"],
        )


class MediaGenerationAgent:
    """Lightweight agent that produces static or animated media assets."""

    def __init__(self, output_root: Union[Path, str] = "results") -> None:
        self.output_root = Path(output_root)
        self.output_root.mkdir(parents=True, exist_ok=True)

    def generate(
        self, spec: MediaSpec, topic_slug: Optional[str] = None
    ) -> Path:
        """Create the requested asset and return the filesystem path."""
        media_dir = self._resolve_media_dir(topic_slug)
        media_dir.mkdir(parents=True, exist_ok=True)
        output_path = media_dir / spec.filename
        handler = getattr(
            self, f"_generate_{spec.kind.lower()}", None
        )
        if handler is None:
            raise ValueError(f"Unsupported media kind '{spec.kind}'.")
        handler(spec, output_path)
        return output_path

    # ------------------------------------------------------------------
    # Generation implementations
    # ------------------------------------------------------------------
    def _generate_chart(self, spec: MediaSpec, output_path: Path) -> None:
        self._require_dependency(plt, "matplotlib")
        if not spec.series:
            raise ValueError("Chart spec must include at least one series.")
        x_labels = list(spec.x_labels)
        x_default = list(range(len(spec.series[0].get("values", []))))
        if not x_labels:
            x_labels = [str(x) for x in x_default]
        fig_width = max(spec.width / 100, 4)
        fig_height = max(spec.height / 100, 3)
        plt.figure(figsize=(fig_width, fig_height))
        for idx, serie in enumerate(spec.series):
            values = serie.get("values", [])
            label = serie.get("label", f"series_{idx+1}")
            color = spec.palette[idx % len(spec.palette)]
            if spec.chart_kind == "bar":
                offsets = [i + (idx * 0.2) for i in range(len(values))]
                plt.bar(offsets, values, width=0.2, color=color, label=label)
            else:
                plt.plot(x_labels, values, marker="o", color=color, label=label)
        plt.title(spec.title or "Generated Chart")
        plt.xlabel(spec.description or "")
        plt.grid(True, linestyle="--", alpha=0.3)
        plt.legend()
        plt.tight_layout()
        plt.savefig(output_path, dpi=144)
        plt.close()

    def _generate_diagram(self, spec: MediaSpec, output_path: Path) -> None:
        if not spec.nodes:
            raise ValueError("Diagram spec must include at least one node.")
        mermaid_source = self._build_mermaid_source(spec)
        text_exts = {".mmd", ".mermaid", ".md", ".txt"}
        if output_path.suffix.lower() in text_exts:
            output_path.write_text(mermaid_source, encoding="utf-8")
            return
        self._render_mermaid_to_file(mermaid_source, output_path, spec)

    def _generate_image(self, spec: MediaSpec, output_path: Path) -> None:
        self._require_dependency(Image, "Pillow")
        width, height = max(spec.width, 320), max(spec.height, 240)
        image = Image.new("RGB", (width, height), color=spec.palette[0])
        draw = ImageDraw.Draw(image)
        font = self._resolve_font()
        text = spec.text or spec.title or "Generated Image"
        wrapped = self._wrap_text(text, font, width - 80)
        draw.rectangle([(20, 20), (width - 20, height - 20)], outline="white", width=3)
        draw.multiline_text(
            (40, height // 3),
            wrapped,
            fill="white",
            font=font,
            align="center",
        )
        image.save(output_path)

    def _generate_video(self, spec: MediaSpec, output_path: Path) -> None:
        self._require_dependency(Image, "Pillow")
        self._require_dependency(imageio, "imageio")
        frames: List[Any] = []
        base_text = spec.text or spec.title or "Generated Clip"
        for idx in range(max(spec.frames, 2)):
            image = Image.new(
                "RGB",
                (max(spec.width, 640), max(spec.height, 360)),
                color=spec.palette[idx % len(spec.palette)],
            )
            draw = ImageDraw.Draw(image)
            font = self._resolve_font(size=36)
            text = f"{base_text}\nFrame {idx + 1}"
            wrapped = self._wrap_text(text, font, image.width - 80)
            draw.multiline_text(
                (40, image.height // 3),
                wrapped,
                fill="white",
                font=font,
                align="center",
            )
            frames.append(image)
        ext = output_path.suffix.lower()
        if ext != ".gif":
            output_path = output_path.with_suffix(".gif")
        array_frames = [np.array(frame.convert("RGB")) for frame in frames]
        imageio.mimsave(
            output_path,
            array_frames,
            duration=1 / max(spec.fps, 1),
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _resolve_media_dir(self, topic_slug: Optional[str]) -> Path:
        if topic_slug:
            return self.output_root / topic_slug / "media"
        return self.output_root / "media"

    def _require_dependency(self, module: Any, name: str) -> None:
        if module is None:
            raise RuntimeError(
                f"The '{name}' package is required for this media generation step. "
                "Install the optional dependency listed in requirements.txt."
            )

    def _resolve_font(self, size: int = 24):
        if ImageFont is None:
            return None
        try:
            return ImageFont.truetype("arial.ttf", size)
        except Exception:
            return ImageFont.load_default()

    def _wrap_text(self, text: str, font: Any, max_width: int) -> str:
        if ImageFont is None or font is None:
            return text
        words = text.split()
        lines: List[str] = []
        current: List[str] = []
        draw = ImageDraw.Draw(Image.new("RGB", (10, 10)))
        for word in words:
            trial = " ".join(current + [word])
            width = draw.textlength(trial, font=font)
            if width <= max_width:
                current.append(word)
            else:
                lines.append(" ".join(current))
                current = [word]
        if current:
            lines.append(" ".join(current))
        return "\n".join(lines)

    def _build_mermaid_source(self, spec: MediaSpec) -> str:
        valid_directions = {"TD", "TB", "BT", "LR", "RL"}
        direction = spec.diagram_direction.strip().upper() or "TD"
        if direction not in valid_directions:
            direction = "TD"
        lines: List[str] = [f"graph {direction}"]
        if spec.title:
            lines.insert(0, f"%% {spec.title}")
        node_aliases: Dict[str, str] = {}
        seen_aliases: Dict[str, int] = {}
        for idx, node_label in enumerate(spec.nodes):
            alias = self._sanitize_mermaid_identifier(str(node_label), idx, seen_aliases)
            node_aliases[str(node_label)] = alias
            safe_label = str(node_label).replace('"', '\\"')
            lines.append(f'    {alias}["{safe_label}"]')
        for edge in spec.edges:
            if len(edge) < 2:
                continue
            source, target = str(edge[0]), str(edge[1])
            src_alias = node_aliases.get(source)
            dst_alias = node_aliases.get(target)
            if src_alias is None or dst_alias is None:
                continue
            if len(edge) >= 3 and edge[2]:
                label = str(edge[2]).replace('"', '\\"')
                lines.append(f"    {src_alias} -->|{label}| {dst_alias}")
            else:
                lines.append(f"    {src_alias} --> {dst_alias}")
        if spec.description:
            lines.append(f"%% {spec.description}")
        return "\n".join(lines) + "\n"

    def _sanitize_mermaid_identifier(
        self, label: str, idx: int, seen_aliases: Dict[str, int]
    ) -> str:
        base = re.sub(r"[^0-9a-zA-Z_]", "_", label).strip("_").lower()
        if not base:
            base = f"node_{idx}"
        if base[0].isdigit():
            base = f"n_{base}"
        count = seen_aliases.get(base, 0)
        seen_aliases[base] = count + 1
        if count:
            base = f"{base}_{count}"
        return base

    def _render_mermaid_to_file(
        self, mermaid_source: str, output_path: Path, spec: MediaSpec
    ) -> None:
        mmdc_path = shutil.which("mmdc")
        if mmdc_path is None:
            fallback_path = output_path.with_suffix(".mmd")
            fallback_path.write_text(mermaid_source, encoding="utf-8")
            raise RuntimeError(
                "Mermaid CLI 'mmdc' is required to render diagrams as image files. "
                "Install '@mermaid-js/mermaid-cli' (npm) and ensure 'mmdc' is on PATH. "
                f"Mermaid source was saved to '{fallback_path}'."
            )
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".mmd", delete=False, encoding="utf-8"
        ) as handle:
            handle.write(mermaid_source)
        temp_path = Path(handle.name)
        try:
            result = subprocess.run(
                [
                    mmdc_path,
                    "-i",
                    str(temp_path),
                    "-o",
                    str(output_path),
                    "-w",
                    str(max(spec.width, 600)),
                    "-H",
                    str(max(spec.height, 400)),
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
            if result.returncode != 0:
                stderr = result.stderr.decode("utf-8", errors="ignore").strip()
                raise RuntimeError(
                    f"Mermaid CLI failed with exit code {result.returncode}: {stderr}"
                )
        finally:
            temp_path.unlink(missing_ok=True)


def load_media_specs(source: Union[Path, str]) -> Dict[str, Any]:
    """Load a JSON specification from disk."""
    path = Path(source)
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)
