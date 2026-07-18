# Pipecat Interview UI

React frontend for a voice-based mock interview app. User picks an interview
type, then connects to your Pipecat bot over WebRTC (Daily transport, RTVI
client).

## Setup

```bash
npm install
cp .env.example .env   # then edit VITE_PIPECAT_CONNECT_URL
npm run dev
```

## What this expects from your Pipecat server

I don't have your server code, so I can't tell you whether it currently has
a problem — but here's exactly what this UI assumes, so you can check it
against what you've built:

1. **A REST "connect" endpoint** (`VITE_PIPECAT_CONNECT_URL`, e.g.
   `POST /connect`) that:
   - Accepts a JSON body: `{ "interview_type": "behavioral" }` — sent as
     `requestData` in `client.connect()` (see `InterviewSession.jsx`).
   - Spins up (or joins) a Daily room for this session, and returns JSON
     the RTVI Daily transport expects — at minimum a room URL and token,
     e.g. `{ "room_url": "...", "token": "..." }` (exact shape depends on
     your Pipecat server version's RTVI connect handler).
   - Uses `interview_type` to select which system prompt / flow config the
     bot pipeline should run for that call.
   - Has CORS enabled for your frontend's origin, since this is a
     browser `fetch` call.

2. **A Pipecat pipeline that emits RTVI events**, since the UI listens for:
   - `BotStartedSpeaking` / `BotStoppedSpeaking`
   - `UserStartedSpeaking` / `UserStoppedSpeaking`
   - `BotTranscript` / `UserTranscript`
   - `Error`

   If your pipeline doesn't have an `RTVIProcessor` (or equivalent) wired
   in, these events won't fire and the orb/transcript will sit idle even
   though audio is flowing.

3. **A Daily room per session** (not a single shared room), otherwise
   concurrent interviews will collide.

## Files

- `src/App.jsx` — creates the `PipecatClient`, holds top-level screen state.
- `src/pages/InterviewSelect.jsx` — interview type picker.
- `src/pages/InterviewSession.jsx` — connects, shows live state + transcript.
- `src/components/VoiceOrb.jsx` — call-state visual.
- `src/components/Transcript.jsx` — scrolling transcript.
- `src/styles/app.css` — all styling, no CSS framework required.

## Adjusting to your server

- If your server uses a **plain WebSocket transport** instead of Daily,
  swap `DailyTransport` in `App.jsx` for
  `@pipecat-ai/websocket-transport`'s `WebsocketTransport`, and change
  `connect()`'s `endpoint`/`requestData` shape to match.
- If your connect route returns a different JSON shape than the RTVI
  default, you may need a small adapter — happy to write one if you share
  the response format.
- Package versions in `package.json` are placeholders (`^0.5.0`) — pin
  them to whatever your Pipecat server's SDK version actually expects, or
  paste your `pip`/`requirements.txt` pipecat version and I'll match them.

## Want the server checked too?

Upload your Pipecat server files (the connect route + pipeline setup) and
I'll review them against what this UI expects.

## Scoring (added)

When the user clicks "End Interview", the client sends a `request_score`
message over the RTVI data channel, the server asks Gemini for a JSON
verdict (`score`, `strengths`, `improvements`, `summary`) based on the
transcript accumulated in `context`, and sends it back before the client
disconnects. Requires `google-genai` installed server-side
(`pip install google-genai`) alongside whatever `pipecat-ai[google]` extra
you're already using for `GeminiLiveLLMService`.

**Unverified API surface, please check:** `client.sendClientMessage(...)` on
the JS side and `rtvi.event_handler("on_client_message")` /
`rtvi.send_server_message(...)` on the Python side are based on the RTVI
protocol's documented client<->server messaging pattern, but I haven't
confirmed the exact method names against your installed SDK versions. If
scoring doesn't come back, check:
- Browser console for an error on `client.sendClientMessage`
- Server logs for `CLIENT MESSAGE: ...` — if it never logs, the message
  isn't reaching the server at all
- Server logs for `Scoring interview on client request` — if this logs but
  no score arrives client-side, the issue is in `send_server_message` or
  the client's `ServerMessage` event name
"# AI-interview-Agent-frontend" 
