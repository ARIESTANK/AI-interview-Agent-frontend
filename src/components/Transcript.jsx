import { useEffect, useRef } from "react";
import heroPng from "../components/assets/hero.png";

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
   <div className="transcript space-y-5">
  {botMessages.map((m, i) => (
    <div key={i} className="flex items-start gap-3 animate-fade-in">
      {/* Stylized AI Avatar Container */}
      <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-pink-50 border border-pink-100 flex items-center justify-between text-base shadow-sm">
       <img src={heroPng} alt="" />
      </div>

      {/* Chat Bubble Layout */}
      <div className="flex flex-col max-w-[85%]">
        {/* Label Metadata */}
        <span className="text-[10px] font-bold tracking-wider text-pink-600 uppercase mb-1 ml-1">
          Interviewer AI
        </span>
        
        {/* Content Bubble */}
        <div className="bg-slate-50 border border-slate-100 text-slate-800 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
          <p className="text-sm leading-relaxed antialiased font-normal whitespace-pre-wrap">
            {m.text}
          </p>
        </div>
      </div>
    </div>
  ))}
  <div ref={endRef} />
</div>
  );
}
