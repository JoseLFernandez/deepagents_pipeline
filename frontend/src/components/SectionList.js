import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
export function SectionList({ sections, selected, onSelect }) {
    return (_jsx("div", { className: "section-list", children: sections.map((section) => (_jsxs("button", { className: selected === section.index ? "active" : "", onClick: () => onSelect(section.index), children: [section.index, ". ", section.title] }, section.index))) }));
}
