import "./PhaseStepper.css";

export type Phase = {
  id: string;
  label: string;
};

interface Props {
  phases: Phase[];
  current: string;
}

export function PhaseStepper({ phases, current }: Props) {
  return (
    <div className="phase-stepper">
      {phases.map((phase, idx) => {
        const active = current === phase.id;
        const complete = phases.findIndex((p) => p.id === current) > idx;
        return (
          <div
            key={phase.id}
            className={`phase-chip ${active ? "active" : ""} ${complete ? "complete" : ""}`}
          >
            <span className="phase-index">{phase.id}</span>
            <span>{phase.label}</span>
          </div>
        );
      })}
    </div>
  );
}
