import { useEffect, useRef } from "react";

// Only the interviewer's (bot) lines are ever rendered here — the
// candidate's own spoken/transcribed answers are intentionally omitted
// from this view, even though they still exist in the parent's
// `messages` state (e.g. for scoring).
export default function Transcript({ messages }) {
  const endRef = useRef(null);
  const botMessages = messages.filter((m) => m.role === "bot");

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [botMessages.length]);

  if (botMessages.length === 0) {
    return (
      <div className="transcript transcript--empty">
        <p>The interviewer's questions will appear here once the conversation starts.</p>
      </div>
    );
  }

  return (
    <div className="transcript">
      {botMessages.map((m, i) => (
        <div key={i} className="chat-row">
          <div className="chat-avatar">🤖</div>
          <div className="chat-bubble">
            <span className="chat-bubble-label">Interviewer</span>
            <span className="chat-bubble-text">{m.text}</span>
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
