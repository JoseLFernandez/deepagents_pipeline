import { useEffect, useState } from "react";
import { Section } from "../types";

type Props = {
  sections: Section[];
  selected: number | null;
  onSelect: (index: number) => void;
  perspective: "working" | "original";
};

export function SectionAccordion({ sections, selected, onSelect, perspective }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    setExpanded(new Set(selected != null ? [selected] : []));
  }, [perspective, sections, selected]);

  const toggle = (index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="section-accordion">
      {!sections.length && <p className="accordion-empty">No sections available.</p>}
      {sections.map((sec) => {
        const isOpen = expanded.has(sec.index);
        const isActive = selected === sec.index;
        return (
          <article
            key={`${perspective}-${sec.index}`}
            className={`accordion-item ${isOpen ? "open" : ""} ${isActive ? "active" : ""}`}
          >
            <header className="accordion-header">
              <button type="button" className="accordion-toggle" onClick={() => toggle(sec.index)}>
                <span>{isOpen ? "▾" : "▸"}</span>
                <strong>
                  {sec.index}. {sec.title}
                </strong>
              </button>
              <div className="accordion-actions">
                <button type="button" onClick={() => onSelect(sec.index)}>
                  Edit
                </button>
              </div>
            </header>
            {isOpen && (
              <div className="accordion-body" dangerouslySetInnerHTML={{ __html: sec.html }} />
            )}
          </article>
        );
      })}
    </div>
  );
}
