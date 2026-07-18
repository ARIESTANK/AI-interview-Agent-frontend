import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  usePipecatClientTransportState,
  useRTVIClientEvent,
} from "@pipecat-ai/client-react";
import { RTVIEvent } from "@pipecat-ai/client-js";

import VoiceOrb from "../components/VoiceOrb";
import Transcript from "../components/Transcript";
import "../styles/app.css"
export default function InterviewSession({
  client,
  startUrl,
  interviewTypes,
  onExit,
}) {
  const { type } = useParams();

  const interviewType = interviewTypes?.find(
    (item) => item.id === type
  );

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


  /*
   * Prevent undefined interview type crash
   */
  if (!interviewType) {
    return (
      <div className="session-screen">
        <h2>Interview type not found</h2>
        <p>
          Invalid route:
          <b> {type}</b>
        </p>

        <button
          className="start-button"
          onClick={onExit}
        >
          Back
        </button>
      </div>
    );
  }


  const connecting =
    transportState === "connecting" ||
    transportState === "authenticating";

  const connected =
    transportState === "connected" ||
    transportState === "ready";


  /*
   * Speaking events
   */
  useRTVIClientEvent(
    RTVIEvent.BotStartedSpeaking,
    () => setBotSpeaking(true)
  );

  useRTVIClientEvent(
    RTVIEvent.BotStoppedSpeaking,
    () => setBotSpeaking(false)
  );

  useRTVIClientEvent(
    RTVIEvent.UserStartedSpeaking,
    () => setUserSpeaking(true)
  );

  useRTVIClientEvent(
    RTVIEvent.UserStoppedSpeaking,
    () => setUserSpeaking(false)
  );


  /*
   * Transcript
   */
  useRTVIClientEvent(
    RTVIEvent.BotTranscript,
    (data) => {
      if (!data?.text) return;

      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: data.text,
        },
      ]);
    }
  );


  useRTVIClientEvent(
    RTVIEvent.UserTranscript,
    (data) => {
      if (!data?.text || !data.final) return;

      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          text: data.text,
        },
      ]);
    }
  );


  /*
   * Receive score
   */
  useRTVIClientEvent(
    RTVIEvent.ServerMessage,
    (message) => {
      console.log(
        "[interview] server message:",
        message
      );

      if (message?.type !== "interview_score")
        return;

      setResult(message.data);

      scoreResolverRef.current?.();

      scoreResolverRef.current = null;
    }
  );


  /*
   * Errors
   */
  useRTVIClientEvent(
    RTVIEvent.Error,
    (e) => {
      console.error("[RTVI error]", e);

      setError(
        e?.message ||
        "Something went wrong."
      );
    }
  );


  /*
   * Connect Pipecat
   */
  useEffect(() => {

    let cancelled = false;

    const controller =
      new AbortController();


    async function connect() {

      try {

        setError(null);


        console.log(
          "[interview] POST:",
          startUrl
        );

        console.log(
          "[interview] field:",
          interviewType.id
        );


        const startRes =
          await fetch(
            startUrl,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              signal:
                controller.signal,


              body: JSON.stringify({
                transport:
                  "webrtc",

                enableDefaultIceServers:
                  true,

                body:{
                  field:
                    interviewType.id,
                },
              }),
            }
          );


        if (!startRes.ok){

          const text =
            await startRes.text();

          throw new Error(
            `/start failed ${startRes.status}: ${text}`
          );
        }


        const startData =
          await startRes.json();


        console.log(
          "[interview] response:",
          startData
        );


        const sessionId =
          startData?.sessionId;


        if(!sessionId){
          throw new Error(
            "Missing sessionId"
          );
        }


        const offerUrl =
          new URL(
            `/sessions/${sessionId}/api/offer`,
            startUrl
          ).toString();



        console.log(
          "[interview] offer:",
          offerUrl
        );


        await client.connect({
          webrtcUrl:
            offerUrl,
        });



        if(cancelled)
          return;



        startedAt.current =
          Date.now();


        timerRef.current =
          setInterval(
            ()=>{
              setElapsed(
                Math.floor(
                  (
                    Date.now() -
                    startedAt.current
                  ) / 1000
                )
              );
            },
            1000
          );



      }
      catch(err){

        console.error(
          "[interview] connect failed:",
          err
        );


        if(!cancelled){

          setError(
            err.message ||
            "Connection failed"
          );
        }
      }

    }


    connect();


    return ()=>{

      cancelled=true;

      controller.abort();

      clearInterval(
        timerRef.current
      );

      client.disconnect()
        .catch(()=>{});

    };


  },[
    client,
    startUrl,
    interviewType.id
  ]);



  const handleEnd =
    useCallback(async()=>{

      setEnding(true);

      clearInterval(
        timerRef.current
      );


      try{

        const scorePromise =
          new Promise(
            resolve=>{
              scoreResolverRef.current =
                resolve;
            }
          );


        await client
          .sendClientMessage?.(
            "request_score"
          );


        await Promise.race([
          scorePromise,

          new Promise(
            resolve=>
              setTimeout(
                resolve,
                12000
              )
          )
        ]);

      }
      catch(err){

        console.error(
          err
        );

      }


      await client.disconnect()
        .catch(()=>{});


      setEnding(false);


    },[client]);



  const handleExit =
    useCallback(()=>{

      setResult(null);

      onExit();

    },[onExit]);



  const mm =
    String(
      Math.floor(
        elapsed / 60
      )
    ).padStart(2,"0");


  const ss =
    String(
      elapsed % 60
    ).padStart(2,"0");



  /*
   * Your existing JSX UI can stay exactly the same.
   * Replace only the old component opening logic.
   */


  return (
    <div className="session-screen">

      <div className="session-topbar">

        <span>
          {interviewType.label}
          {" "}Interview
        </span>

        <span>
          {
            connected
              ? `${mm}:${ss}`
              : "--:--"
          }
        </span>

      </div>


      <div className="session-grid">


        <div className="panel">

          <VoiceOrb
            state={
              error
              ? "error"
              : connecting
              ? "connecting"
              : connected
              ? "connected"
              : "idle"
            }

            botSpeaking={
              botSpeaking
            }

            userSpeaking={
              userSpeaking
            }
          />


          <h3>
            AI Interviewer
          </h3>


          <p>
            Conducting
            {" "}
            {interviewType.label}
            {" "}
            interview
          </p>


        </div>


        <div className="panel">

          <button
            onClick={handleEnd}
            disabled={ending}
          >
            {
              ending
              ? "Scoring..."
              : "End Session"
            }
          </button>


          {
            error &&
            <p>
              {error}
            </p>
          }


          <Transcript
            messages={messages}
          />


        </div>


      </div>


    </div>
  );
}
