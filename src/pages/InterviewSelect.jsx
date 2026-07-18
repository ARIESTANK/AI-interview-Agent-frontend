import { useState } from "react";

export default function InterviewSelect({ types, onStart }) {
  const [selected, setSelected] = useState(types[0]?.id ?? null);

  const chosen = types.find((t) => t.id === selected);

  return (
    <div className="select-screen">
      <div className="select-header">
        <span className="eyebrow">Mock Interview</span>
        <h1>Choose your format</h1>
        <p className="sub">
          Pick the interview type. Your voice interviewer adapts its
          questions and pacing to match.
        </p>
      </div>

      <div className="type-grid">
        {types.map((t, i) => (
          <button
            key={t.id}
            className={`type-card ${selected === t.id ? "is-selected" : ""}`}
            onClick={() => setSelected(t.id)}
            aria-pressed={selected === t.id}
          >
            <span className="type-index">{String(i + 1).padStart(2, "0")}</span>
            <span className="type-label">{t.label}</span>
            <span className="type-tagline">{t.tagline}</span>
            <span className="type-duration">{t.duration}</span>
          </button>
        ))}
      </div>

      <div className="select-footer">
        <button
          className="start-button"
          disabled={!chosen}
          onClick={() => chosen && onStart(chosen)}
        >
          Start {chosen ? chosen.label : ""} Interview
        </button>
      </div>
    </div>
  );
}
