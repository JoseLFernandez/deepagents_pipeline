"""Model evaluation helpers for the DeepAgents pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional

from pipeline import PipelineResult, ResearchPipeline


@dataclass
class EvaluationRecord:
    model_name: str
    latex_chars: int
    tex_path: str
    pdf_path: Optional[str]
    notes: Dict[str, str] = field(default_factory=dict)


class ModelEvaluator:
    """Run the same research topic against multiple LLMs and collect stats."""

    def __init__(self, pipeline: Optional[ResearchPipeline] = None) -> None:
        self.pipeline = pipeline or ResearchPipeline()
        self.records: List[EvaluationRecord] = []

    def evaluate(
        self,
        topic: str,
        model_names: Iterable[str],
        compile_pdf: bool = False,
    ) -> List[EvaluationRecord]:
        self.records.clear()
        for name in model_names:
            result: PipelineResult = self.pipeline.run(
                topic,
                llm_name=name,
                compile_pdf=compile_pdf,
            )
            self.records.append(
                EvaluationRecord(
                    model_name=name,
                    latex_chars=len(result.latex_body),
                    tex_path=result.tex_path,
                    pdf_path=result.pdf_path,
                    notes={"topic": topic},
                )
            )
        return self.records
