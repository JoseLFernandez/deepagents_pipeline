import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import "./PhaseStepper.css";
export function PhaseStepper({ phases, current }) {
    return (_jsx("div", { className: "phase-stepper", children: phases.map((phase, idx) => {
            const active = current === phase.id;
            const complete = phases.findIndex((p) => p.id === current) > idx;
            return (_jsxs("div", { className: `phase-chip ${active ? "active" : ""} ${complete ? "complete" : ""}`, children: [_jsx("span", { className: "phase-index", children: phase.id }), _jsx("span", { children: phase.label })] }, phase.id));
        }) }));
}
