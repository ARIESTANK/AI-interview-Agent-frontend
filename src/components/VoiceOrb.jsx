// Signature visual element: a breathing orb that reflects who is speaking.
// state: "idle" | "connecting" | "connected" | "error"
export default function VoiceOrb({ state, botSpeaking, userSpeaking }) {
  const cls = [
    "voice-orb",
    `voice-orb--${state}`,
    botSpeaking ? "voice-orb--bot" : "",
    userSpeaking ? "voice-orb--user" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="voice-orb-wrap">
      <div className={cls}>
        <div className="voice-orb-core" />
        <div className="voice-orb-ring voice-orb-ring--1" />
        <div className="voice-orb-ring voice-orb-ring--2" />
      </div>
    </div>
  );
}
