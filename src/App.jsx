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
  { id: "frontend_developer", label: "Frontend Developer" },
  { id: "backend_engineer", label: "Backend Engineer" },
  { id: "full_stack_developer", label: "Full Stack Developer" },
  { id: "data_analyst", label: "Data Analyst" },
  { id: "data_engineer", label: "Data Engineer" },
  { id: "qa_automation_engineer", label: "QA Automation Engineer" },
  { id: "product_designer", label: "Product Designer" },
  { id: "devops_engineer", label: "DevOps Engineer" },
  { id: "mobile_developer", label: "Mobile Developer" },
  { id: "junior_software_engineer", label: "Junior Software Engineer" },
  { id: "machine_learning_engineer", label: "Machine Learning Engineer" },
  { id: "cloud_security_engineer", label: "Cloud Security Engineer" },
  { id: "android_developer", label: "Android Developer" },
  { id: "technical_writer", label: "Technical Writer" },
  { id: "solutions_architect", label: "Solutions Architect" },
  { id: "ruby_on_rails_developer", label: "Ruby on Rails Developer" },
  { id: "embedded_systems_engineer", label: "Embedded Systems Engineer" },
  { id: "product_manager", label: "Product Manager" },
  { id: "support_engineer", label: "Support Engineer" },
  { id: "ai_application_developer", label: "AI Application Developer" },
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