import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
export function SectionAccordion({ sections, selected, onSelect, perspective }) {
    const [expanded, setExpanded] = useState(new Set());
    useEffect(() => {
        setExpanded(new Set(selected != null ? [selected] : []));
    }, [perspective, sections, selected]);
    const toggle = (index) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            }
            else {
                next.add(index);
            }
            return next;
        });
    };
    return (_jsxs("div", { className: "section-accordion", children: [!sections.length && _jsx("p", { className: "accordion-empty", children: "No sections available." }), sections.map((sec) => {
                const isOpen = expanded.has(sec.index);
                const isActive = selected === sec.index;
                return (_jsxs("article", { className: `accordion-item ${isOpen ? "open" : ""} ${isActive ? "active" : ""}`, children: [_jsxs("header", { className: "accordion-header", children: [_jsxs("button", { type: "button", className: "accordion-toggle", onClick: () => toggle(sec.index), children: [_jsx("span", { children: isOpen ? "▾" : "▸" }), _jsxs("strong", { children: [sec.index, ". ", sec.title] })] }), _jsx("div", { className: "accordion-actions", children: _jsx("button", { type: "button", onClick: () => onSelect(sec.index), children: "Edit" }) })] }), isOpen && (_jsx("div", { className: "accordion-body", dangerouslySetInnerHTML: { __html: sec.html } }))] }, `${perspective}-${sec.index}`));
            })] }));
}
