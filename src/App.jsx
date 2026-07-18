import { useState } from "react";
import {
  Routes,
  Route,
} from "react-router-dom";

import { PipecatClient } from "@pipecat-ai/client-js";
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport";
import {
  PipecatClientProvider,
  PipecatClientAudio,
} from "@pipecat-ai/client-react";

import InterviewSelect from "./pages/InterviewSelect";
import InterviewSession from "./pages/InterviewSession";

const START_URL =
  import.meta.env.VITE_PIPECAT_START_URL ||
  "https://charlene-cutaneous-nonextrinsically.ngrok-free.dev/start";

export const INTERVIEW_TYPES = [
  {
    id: "generaltech",
    label: "General Tech",
  },
  {
    id: "webdevelopment",
    label: "Web Development",
  },
  {
    id: "networking",
    label: "Networking",
  },
];

function createClient() {
  return new PipecatClient({
    transport: new SmallWebRTCTransport(),
    enableMic: true,
    enableCam: false,
  });
}

export default function App() {
  const [client] = useState(createClient);

  return (
    <PipecatClientProvider client={client}>
      <Routes>
        <Route
          path="/"
          element={
            <InterviewSelect
              types={INTERVIEW_TYPES}
            />
          }
        />

        <Route
          path="/interview/:type"
          element={
            <InterviewSession
              client={client}
          startUrl={START_URL}
          interviewTypes={INTERVIEW_TYPES}
          onExit={() => navigate("/")}
            />
          }
        />
      </Routes>

      <PipecatClientAudio />
    </PipecatClientProvider>
  );
}
