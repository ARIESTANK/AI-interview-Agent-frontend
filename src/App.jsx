import { useState } from "react";
import {
  Routes,
  Route,
  useNavigate,
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

// IDs must exactly match the backend's FIELDS/TOPIC_HINTS keys
// (see get_field_config in the Python config) or the backend will
// silently fall back to DEFAULT_FIELD.
export const INTERVIEW_TYPES = [
  {
    id: "tech",
    label: "General Tech",
  },
  {
    id: "web-dev",
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

function AppRoutes({ client }) {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route
        path="/"
        element={<InterviewSelect types={INTERVIEW_TYPES} />}
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
  );
}

export default function App() {
  const [client] = useState(createClient);

  return (
    <PipecatClientProvider client={client}>
      <AppRoutes client={client} />
      <PipecatClientAudio />
    </PipecatClientProvider>
  );
}