import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  usePipecatClientTransportState,
  useRTVIClientEvent,
} from "@pipecat-ai/client-react";
import { RTVIEvent } from "@pipecat-ai/client-js";

import VoiceOrb from "../components/VoiceOrb";
import Transcript from "../components/Transcript";
import { Navbar } from "../components/Navbar";

import heroPng from "../components/assets/hero.png";

export default function InterviewSession({
  client,
  startUrl,
  interviewTypes,
  onExit,
}) {
  const { type } = useParams();

  // Resolved once per render; hooks still run unconditionally.
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
   * Score result
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
   * Connect to the Pipecat bot
   */
  useEffect(() => {
    if (!interviewType) return;

    let cancelled = false;
    const controller = new AbortController();

    async function connect() {
      setError(null);

      try {
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
        const sessionId = startData?.sessionId;
        if (!sessionId) {
          throw new Error("No sessionId in /start response");
        }

        const offerUrl = new URL(
          `/sessions/${sessionId}/api/offer`,
          startUrl
        ).toString();

        await client.connect({ webrtcUrl: offerUrl });

        if (cancelled) return;

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
   * End interview
   */
  const handleEnd = useCallback(async () => {
    setEnding(true);
    clearInterval(timerRef.current);

    try {
      const scorePromise = new Promise((resolve) => {
        scoreResolverRef.current = resolve;
      });

      if (typeof client.sendClientMessage !== "function") {
        throw new Error("This client build doesn't expose sendClientMessage");
      }

      client.sendClientMessage("request_score");

      const scopink = await Promise.race([
        scorePromise.then(() => true),
        new Promise((resolve) => setTimeout(() => resolve(false), 12000)),
      ]);

      if (!scopink) {
        setError((prev) => prev ?? "Didn't receive a score from the interviewer in time.");
      }
    } catch (err) {
      setError((prev) => prev ?? (err.message || "Failed to request the interview score."));
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
   * Clean White Base Layout Wrapper
   */
  const LayoutWrapper = ({ children }) => (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col font-sans">
      <Navbar />
      <main className="flex-1 flex flex-col p-4 md:p-6 max-w-7xl w-full mx-auto gap-6">
        {children}
      </main>
    </div>
  );

  /* Early Return: Invalid Route Param */
  if (!interviewType) {
    return (
      <LayoutWrapper>
        <div className="flex flex-col items-center justify-center flex-1 text-center max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Interview type not found</h2>
          <p className="text-slate-500 mb-6">
            Invalid route parameters: <b className="text-pink-500 font-mono">{type}</b>
          </p>
          <button
            className="w-full py-3 px-6 bg-pink-600 hover:bg-pink-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-pink-600/20"
            onClick={onExit}
          >
            Back to Dashboard
          </button>
        </div>
      </LayoutWrapper>
    );
  }

  /* Early Return: Score/Results View */
  if (result) {
    return (
      <LayoutWrapper>
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <span className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Session Complete
          </span>
          <span className="text-sm font-medium tracking-wide text-slate-500">
            {interviewType.label} Interview
          </span>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-2xl bg-slate-50 border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
            <div className="flex flex-col items-center mb-8">
              <div className="w-24 h-24 rounded-full border-4 border-pink-500 flex flex-col items-center justify-center bg-pink-50 mb-4 shadow-sm">
                <span className="text-3xl font-bold text-pink-600 leading-none">{result.score}</span>
                <span className="text-xs text-pink-500 mt-1">/10</span>
              </div>
              <p className="text-slate-600 text-center text-lg leading-relaxed max-w-lg">
                {result.summary}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {result.strengths?.length > 0 && (
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-emerald-700 uppercase tracking-wider mb-3">
                    Key Strengths
                  </h2>
                  <ul className="space-y-2 text-sm text-slate-600">
                    {result.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-500 select-none font-bold">✓</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.improvements?.length > 0 && (
                <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wider mb-3">
                    Areas to Improve
                  </h2>
                  <ul className="space-y-2 text-sm text-slate-600">
                    {result.improvements.map((s, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-amber-500 select-none font-bold">→</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <button
              className="w-full py-3 px-6 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-medium transition-colors"
              onClick={handleExit}
            >
              Back to Start
            </button>
          </div>
        </div>
      </LayoutWrapper>
    );
  }

  const liveStatusLabel = error
    ? "Connection error"
    : connecting
    ? "Connecting"
    : connected
    ? "In Progress"
    : "Idle";

  /* Default Live Active Session Screen */
  return (
    <LayoutWrapper>
      {/* Top Session Stats Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <span className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-pink-50 text-pink-700 rounded-full border border-pink-200">
          <span
            className={`w-2 h-2 rounded-full ${
              connected ? "bg-pink-500 animate-pulse" : "bg-slate-400"
            }`}
          />
          Live Session
        </span>
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium text-slate-500">{interviewType.label} Interview</span>
          <span className="font-mono font-semibold bg-slate-50 px-2.5 py-1 border border-slate-200 rounded text-pink-600">
            {connected ? `${mm}:${ss}` : "--:--"}
          </span>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        
        {/* Left Side Column: Avatar Status Panel */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
          <div>
            <span
              className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full mb-6 ${
                error
                  ? "bg-pink-50 text-pink-700 border border-pink-200"
                  : connecting
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              {liveStatusLabel}
            </span>

            {/* <div className="flex items-center justify-center my-8 aspect-square max-h-48 mx-auto bg-slate-50 border border-slate-100 rounded-full p-4">
              <VoiceOrb
                state={
                  error ? "error" : connecting ? "connecting" : connected ? "connected" : "idle"
                }
                botSpeaking={botSpeaking}
                userSpeaking={userSpeaking}
              />
            </div> */}

             <div className="text-center my-8">
              {/* Animated Glowing Robot Avatar Frame */}
              <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
               
                  <img src={heroPng} alt="" />
                  {/* <span className="absolute -top-2 -right-2 bg-slate-900 text-white p-1.5 rounded-lg shadow-md border border-slate-800">
                    <FiCpu size={14} className="animate-spin [animation-duration:8s]" />
                  </span> */}
               
              </div>
              
             
             
            </div>


            

            <h3 className="text-xl font-bold text-slate-800 text-center mb-1">AI Interviewer</h3>
            <p className="text-slate-500 text-sm text-center leading-relaxed">
              Conducting a live <span className="text-pink-600 font-medium">{interviewType.label}</span> interview via real-time audio pipeline.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 bg-slate-50/50 p-4 rounded-xl">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Assessment Criteria
            </h5>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <span className="text-pink-600 font-bold">✓</span> Conceptual Depth &amp; Accuracy
              </li>
              <li className="flex items-center gap-2">
                <span className="text-pink-600 font-bold">✓</span> Communication Clarity
              </li>
              <li className="flex items-center gap-2">
                <span className="text-pink-600 font-bold">✓</span> Problem-Solving Approach
              </li>
            </ul>
          </div>
        </div>

        {/* Right Side Column: Transcripts & Console */}
        {/* 1. Add 'relative' to the parent container so the floating button anchors to it */}
<div className="relative md:col-span-2 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
  
  {/* Transcript Control Header */}
  <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/30">
    <div>
      <h3 className="text-lg font-bold text-slate-800">Interview Transcript</h3>
      <p className="text-xs text-slate-500 mt-0.5">
        Only the interviewer's direct inputs and prompts are recorded below.
      </p>
    </div>
    <div className="flex items-center gap-2">
      <button
        className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all"
        title="Restart session"
        onClick={() => window.location.reload()}
      >
        ⟲
      </button>
      {/* Note: The 'End Session' button has been removed from here */}
    </div>
  </div>

  {/* Conditional Alerts */}
  {error && (
    <div className="m-4 p-4 bg-pink-50 border border-pink-200 text-pink-700 text-sm rounded-xl flex items-center justify-between" role="alert">
      <div>
        <strong className="font-semibold">Connection issue: </strong> {error}
      </div>
      <button className="text-xs underline font-semibold tracking-wide hover:text-pink-900 ml-4" onClick={() => window.location.reload()}>
        Retry Hook
      </button>
    </div>
  )}

  {!error && connecting && (
    <div className="bg-slate-50/50 border-b border-slate-200 px-5 py-2.5 text-xs font-mono text-amber-700 animate-pulse">
      [pipeline] establishing WebRTC transport connection hooks...
    </div>
  )}

  {!error && connected && (
    <div className="bg-slate-50/50 border-b border-slate-200 px-5 py-2.5 text-xs font-mono text-pink-600">
      {botSpeaking
        ? "[stream] interviewer is active / speaking..."
        : userSpeaking
        ? "[stream] microphone capturing user voice..."
        : "[stream] waiting for dialog turn..."}
    </div>
  )}

  {/* Core Scrollable Content Stream */}
  <div className="flex-1 overflow-y-auto p-5 bg-white">
    <Transcript messages={messages} />
  </div>

  {/* Footer Interactive States */}
  {userSpeaking && (
    <div className="p-4 bg-pink-50/30 border-t border-slate-200 flex items-center gap-3 text-sm text-pink-700">
      <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-ping" />
      <span className="font-medium">Microphone active — speaking to bot</span>
    </div>
  )}

  {/* 2. Floating 'End Session' Button added at the bottom right */}
  <button
    className="absolute bottom-5 right-5 z-10 px-5 py-3 bg-pink-600 hover:bg-pink-500 disabled:bg-pink-200 text-white disabled:text-pink-400 font-semibold text-sm rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
    onClick={handleEnd}
    disabled={ending}
  >
    {ending && (
      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
    )}
    {ending ? "Scoring…" : "End Session"}
  </button>
</div>
      </div>
    </LayoutWrapper>
  );
}