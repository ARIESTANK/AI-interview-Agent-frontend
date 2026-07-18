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

// These are just quick-pick suggestions shown on the select screen.
// They are NOT an allowlist — any slug typed/routed to /interview/:type
// is sent straight to the backend, which handles unknown fields
// dynamically (see get_field_config / build_field_config).
export const SUGGESTED_TYPES = [
  { id: "tech", label: "General Tech" },
  { id: "web-dev", label: "Web Development" },
  { id: "networking", label: "Networking" },
  { id: "data-science", label: "Data Science" },
  { id: "product-management", label: "Product Management" },
  { id: "ux-design", label: "UX Design" },
  { id: "devops", label: "DevOps" },
  { id: "cybersecurity", label: "Cybersecurity" },
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
  const navigate = useNavigate();

  return (
    <PipecatClientProvider client={client}>
      <Routes>
        <Route
          path="/"
          element={
            <InterviewSelect
              suggestedTypes={SUGGESTED_TYPES}
              onSelect={(fieldId) => navigate(`/interview/${fieldId}`)}
            />
          }
        />

        <Route
          path="/interview/:type"
          element={
            <InterviewSession
              client={client}
              startUrl={START_URL}
              onExit={() => navigate("/")}
            />
          }
        />
      </Routes>

      <PipecatClientAudio />
    </PipecatClientProvider>
  );
}