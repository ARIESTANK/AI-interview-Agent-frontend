import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  usePipecatClientTransportState,
  useRTVIClientEvent,
} from "@pipecat-ai/client-react";
import { RTVIEvent } from "@pipecat-ai/client-js";

import VoiceOrb from "../components/VoiceOrb";
import Transcript from "../components/Transcript";
import "../styles/app.css";
export default function InterviewSession({
  client,
  startUrl,
  interviewTypes,
  onExit,
}) {
  const { type } = useParams();

  // Resolved once per render; may be undefined if the route param
  // doesn't match anything in interviewTypes. Every hook below must
  // still run unconditionally regardless of whether this is set.
  const interviewType = interviewTypes?.find((item) => item.id === type);

  const transportState = usePipecatClientTransportState();

  const [error, setError] = useState(null);
  const [botSpeaking, setBotSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [messages, setMessages] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [ending, setEnding] = useState(false);
  const [result, setResult] = useState(null);

  const scoreResolverRef = useRef(null);
  const startedAt = useRef(null);
  const timerRef = useRef(null);

  const connecting =
    transportState === "connecting" || transportState === "authenticating";

  const connected = transportState === "connected" || transportState === "ready";

  /*
   * Speaking events
   */
  useRTVIClientEvent(RTVIEvent.BotStartedSpeaking, () => setBotSpeaking(true));
  useRTVIClientEvent(RTVIEvent.BotStoppedSpeaking, () => setBotSpeaking(false));
  useRTVIClientEvent(RTVIEvent.UserStartedSpeaking, () => setUserSpeaking(true));
  useRTVIClientEvent(RTVIEvent.UserStoppedSpeaking, () => setUserSpeaking(false));

  /*
   * Transcript events
   */
  useRTVIClientEvent(RTVIEvent.BotTranscript, (data) => {
    if (!data?.text) return;
    setMessages((prev) => [...prev, { role: "bot", text: data.text }]);
  });

  useRTVIClientEvent(RTVIEvent.UserTranscript, (data) => {
    if (!data?.text || !data.final) return;
    setMessages((prev) => [...prev, { role: "user", text: data.text }]);
  });

  /*
   * Score result — sent back by the server after we request it on End
   * Interview. `ServerMessage` is RTVI's generic server->client data
   * channel event; we filter by our own `type` field within it.
   */
  useRTVIClientEvent(RTVIEvent.ServerMessage, (message) => {
    console.log("[interview] server message:", message);
    if (message?.type !== "interview_score") return;
    setResult(message.data);
    scoreResolverRef.current?.();
    scoreResolverRef.current = null;
  });

  /*
   * Error events
   */
  useRTVIClientEvent(RTVIEvent.Error, (e) => {
    console.error("[RTVI error]", e);
    setError(e?.message || "Something went wrong while connecting to the interviewer.");
  });

  /*
   * Connect to the Pipecat bot. Guards internally on interviewType so the
   * hook itself always runs (keeping hook order stable across renders),
   * but skips connecting entirely if the route didn't resolve to a valid
   * interview type.
   *
   *   1. POST {startUrl}                      -> { sessionId }
   *   2. client.connect({ webrtcUrl: {startUrl-origin}/sessions/{sessionId}/api/offer })
   */
  useEffect(() => {
    if (!interviewType) return;

    let cancelled = false;
    const controller = new AbortController();

    async function connect() {
      setError(null);

      try {
        console.log("[interview] POST /start ->", startUrl);
        console.log("[interview] field:", interviewType.id);

        const startRes = await fetch(startUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            transport: "webrtc",
            enableDefaultIceServers: true,
            body: { field: interviewType.id },
          }),
        });

        if (!startRes.ok) {
          const text = await startRes.text().catch(() => "");
          throw new Error(
            `/start returned ${startRes.status} ${startRes.statusText}${
              text ? ` — ${text}` : ""
            }`
          );
        }

        const startData = await startRes.json();
        console.log("[interview] /start response:", startData);

        const sessionId = startData?.sessionId;
        if (!sessionId) {
          throw new Error(
            "No sessionId in /start response — check the raw response shown in the console."
          );
        }

        const offerUrl = new URL(
          `/sessions/${sessionId}/api/offer`,
          startUrl
        ).toString();

        console.log("[interview] connecting to offer endpoint:", offerUrl);

        await client.connect({ webrtcUrl: offerUrl });

        if (cancelled) return;

        console.log("[interview] connected");

        startedAt.current = Date.now();
        timerRef.current = setInterval(() => {
          setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
        }, 1000);
      } catch (err) {
        console.error("[interview] connect failed:", err);
        if (!cancelled) {
          setError(err?.message || "Could not connect to the interview server.");
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timerRef.current);
      client.disconnect().catch(() => {});
    };
  }, [client, startUrl, interviewType?.id]);

  /*
   * End interview — ask the bot to score the transcript first, wait for
   * its reply (capped at 12s so a slow/failed score never traps the user),
   * then disconnect. If scoring fails or times out we still let them exit.
   */
  const handleEnd = useCallback(async () => {
    setEnding(true);
    clearInterval(timerRef.current);

    try {
      const scorePromise = new Promise((resolve) => {
        scoreResolverRef.current = resolve;
      });

      await client.sendClientMessage?.("request_score");

      await Promise.race([
        scorePromise,
        new Promise((resolve) => setTimeout(resolve, 12000)),
      ]);
    } catch (err) {
      console.error("[interview] failed to request score:", err);
    }

    await client.disconnect().catch(() => {});
    setEnding(false);
  }, [client]);

  const handleExit = useCallback(() => {
    setResult(null);
    onExit();
  }, [onExit]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  /*
   * Invalid/unknown route param — all hooks above have already run
   * unconditionally, so it's safe to branch here.
   */
  if (!interviewType) {
    return (
      <div className="session-screen">
        <h2>Interview type not found</h2>
        <p>
          Invalid route: <b>{type}</b>
        </p>
        <button className="start-button" onClick={onExit}>
          Back
        </button>
      </div>
    );
  }

  if (result) {
    return (
      <div className="session-screen">
        <div className="session-topbar">
          <span className="live-badge">
            <span className="live-dot live-dot--done" />
            Session Complete
          </span>
          <span className="session-eyebrow">{interviewType.label} Interview</span>
        </div>

        <div className="results-wrap">
          <div className="results-card">
            <div className="results-score-ring">
              <span className="results-score">{result.score}</span>
              <span className="results-score-max">/10</span>
            </div>

            <p className="results-summary">{result.summary}</p>

            <div className="results-grid">
              {result.strengths?.length > 0 && (
                <div className="results-section results-section--good">
                  <h2>Strengths</h2>
                  <ul>
                    {result.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.improvements?.length > 0 && (
                <div className="results-section results-section--improve">
                  <h2>To improve</h2>
                  <ul>
                    {result.improvements.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <button className="start-button start-button--light" onClick={handleExit}>
              Back to Start
            </button>
          </div>
        </div>
      </div>
    );
  }

  const liveStatusLabel = error
    ? "Connection error"
    : connecting
    ? "Connecting"
    : connected
    ? "In Progress"
    : "Idle";

  return (
    <div className="session-screen">
      <div className="session-topbar">
        <span className="live-badge">
          <span className={`live-dot ${connected ? "" : "live-dot--muted"}`} />
          Live Session
        </span>
        <div className="session-topbar-right">
          <span className="session-eyebrow">{interviewType.label} Interview</span>
          <span className="session-timer">{connected ? `${mm}:${ss}` : "--:--"}</span>
        </div>
      </div>

      <div className="session-grid">
        <div className="panel panel--interviewer">
          <div>
            <span className="status-chip">{liveStatusLabel}</span>

            <div className="orb-frame">
              <VoiceOrb
                state={
                  error ? "error" : connecting ? "connecting" : connected ? "connected" : "idle"
                }
                botSpeaking={botSpeaking}
                userSpeaking={userSpeaking}
              />
            </div>

            <h3 className="panel-title">AI Interviewer</h3>
            <p className="panel-sub">
              Conducting a live <span className="accent">{interviewType.label}</span> interview
              over voice.
            </p>
          </div>

          <div className="criteria-box">
            <h5>Assessment Criteria</h5>
            <ul>
              <li>
                <span className="check">✓</span> Conceptual Depth &amp; Accuracy
              </li>
              <li>
                <span className="check">✓</span> Communication Clarity
              </li>
              <li>
                <span className="check">✓</span> Problem-Solving Approach
              </li>
            </ul>
          </div>
        </div>

        <div className="panel panel--terminal">
          <div className="terminal-header">
            <div>
              <h3>Interview Transcript</h3>
              <p>Only the interviewer's questions and remarks are shown here.</p>
            </div>
            <div className="terminal-actions">
              <button
                className="icon-btn"
                title="Restart session"
                onClick={() => window.location.reload()}
              >
                ⟲
              </button>
              <button className="end-chip" onClick={handleEnd} disabled={ending}>
                {ending ? "Scoring…" : "End Session"}
              </button>
            </div>
          </div>

          {error && (
            <div className="error-banner" role="alert">
              <strong>Connection problem.</strong> {error}
              <button className="retry-link" onClick={() => window.location.reload()}>
                Retry
              </button>
            </div>
          )}

          {!error && connecting && (
            <div className="status-strip">Connecting to your AI interviewer...</div>
          )}

          {!error && connected && (
            <div className="status-strip">
              {botSpeaking
                ? "Interviewer is speaking…"
                : userSpeaking
                ? "Listening to you…"
                : "Waiting for response…"}
            </div>
          )}

          <Transcript messages={messages} />

          {userSpeaking && (
            <div className="listening-bar">
              <span className="listen-dot" />
              <span>Microphone active — you're speaking</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}