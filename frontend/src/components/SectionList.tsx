interface Props {
  sections: { index: number; title: string }[];
  selected?: number | null;
  onSelect: (index: number) => void;
}

export function SectionList({ sections, selected, onSelect }: Props) {
  return (
    <div className="section-list">
      {sections.map((section) => (
        <button
          key={section.index}
          className={selected === section.index ? "active" : ""}
          onClick={() => onSelect(section.index)}
        >
          {section.index}. {section.title}
        </button>
      ))}
    </div>
  );
}
