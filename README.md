# AllStay

Hotel tablet service system built with SvelteKit and TypeScript.

This README is written for a fresh device after cloning the GitHub repository. Follow the quick start first. It runs the tablet app and the local MCP services.

Language: English | [中文](./README.zh-CN.md)

---

## Current Startup Status

| Path | Status | Use it now? |
| --- | --- | --- |
| Tablet frontend / SvelteKit app | Works locally | Yes |
| Root `npm run dev` | Starts tablet + MCP services together | Yes |
| MCP servers | Workspace packages are configured | Yes |
| Docker Compose | Present, but production build path still needs separate validation | Optional later |

For the fastest UI-only check, you can still start `apps/tablet` only. For normal local development, use root `npm run dev`.

---

## Requirements

- Node.js 20 or newer
- npm, included with Node.js
- Git

Optional later:

- Docker Desktop, for Redis / Docker Compose
- MySQL, for future PMS integration
- Anthropic API key, only for AI conversation features
- OpenAI API key, only for STT / TTS features

---

## Fresh Clone Quick Start

### 1. Clone and enter the repository

```bash
git clone <your-repo-url>
cd AllStayProject
```

If your folder name is different, enter that folder instead.

### 2. Install dependencies

Run this from the repository root:

```bash
npm install
```

This installs the workspace dependencies, including `apps/tablet`.

### 3. Create the tablet environment file

On macOS / Linux / Git Bash:

```bash
cp .env.example apps/tablet/.env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example apps/tablet/.env
```

For the first frontend-only run, you can leave the placeholder values as-is. AI, speech, Redis, printer, and PMS database features need real values later.

### 4. Start the full local dev environment

From the repository root:

```bash
npm run dev
```

This starts:

| Service | URL |
| --- | --- |
| Tablet app | `http://localhost:5173/login` |
| Dining MCP | `http://127.0.0.1:3001/health` |
| SPA MCP | `http://127.0.0.1:3002/health` |
| Restaurant MCP | `http://127.0.0.1:3003/health` |
| Transport MCP | `http://127.0.0.1:3004/health` |

Open:

```text
http://localhost:5173/login
```

### UI-only startup

If you only want the tablet app without MCP services:

```bash
npm run dev --workspace=apps/tablet -- --host 127.0.0.1
```

Or from the tablet folder:

```bash
cd apps/tablet
npm run dev -- --host 127.0.0.1
```

---

## First Manual Test

1. Open `http://localhost:5173/login`
2. Enter any staff ID, for example `S001`
3. Enter any 4-6 digit PIN, for example `1234`
4. You should be redirected to `/room-select`
5. Enter any 3-4 digit room number, for example `301`
6. You should arrive at `/home`

Pages that should work without MCP / Redis / database:

| Route | Expected result |
| --- | --- |
| `/login` | Staff login page |
| `/room-select` | Room number input |
| `/home` | Main tablet home page |
| `/cart` | Cart UI and local flow |
| `/amenities` | Static hotel amenities |
| `/explore` | Explore hub |

Pages that can call MCP, but may still need Redis/MySQL data depending on the action:

| Route | Why |
| --- | --- |
| `/dining` | Dining MCP is available; real menu data needs PMS database |
| `/spa` | SPA MCP is available; some data is currently mocked |
| `/restaurants` | Restaurant MCP is available; real restaurant data needs PMS database |
| `/explore/transport` | Transport MCP is available with mock options |

---

## Useful Test Commands

### Type check

```bash
npm run check --workspace=apps/tablet
```

### Production build for the tablet app

```bash
npm run build --workspace=apps/tablet
```

### Preview the production build

```bash
npm run preview --workspace=apps/tablet
```

---

## Environment Variables

The template file is `.env.example`. For local tablet development, copy it to `apps/tablet/.env`.

| Variable | Needed for | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | AI conversation endpoint | Optional for basic UI testing |
| `AI_MODEL` | AI conversation endpoint | Has a fallback in code |
| `OPENAI_API_KEY` | Speech-to-text and text-to-speech | Optional for basic UI testing |
| `MCP_DINING_URL` | Dining MCP calls | Defaults to `http://localhost:3001` |
| `MCP_SPA_URL` | SPA MCP calls | Defaults to `http://localhost:3002` |
| `MCP_RESTAURANT_URL` | Restaurant MCP calls | Defaults to `http://localhost:3003` |
| `MCP_TRANSPORT_URL` | Transport MCP calls | Defaults to `http://localhost:3004` |
| `REDIS_URL` | Redis-backed flows | Defaults to `redis://localhost:6379` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PMS database integration | Future / incomplete local path |
| `PRINTER_IP`, `PRINTER_PORT` | Printer integration | Optional |
| `SESSION_SECRET`, `STAFF_PIN_SALT` | Auth/session hardening | Required for production-style deployment |

Do not commit real `.env` files or API keys.

---

## Common Problems

### Port 5173 is already in use

Stop the old dev server, or run Vite on another port:

```bash
npm run dev --workspace=apps/tablet -- --host 127.0.0.1 --port 5174
```

Then open `http://127.0.0.1:5174/login`.

### Root `npm run dev` gets stuck or fails

First check whether old dev servers are still running on ports `5173`, `3001`, `3002`, `3003`, or `3004`. Stop them, then retry:

```bash
npm run dev
```

If you only need the UI while debugging MCP startup, use:

```bash
npm run dev --workspace=apps/tablet -- --host 127.0.0.1
```

### Docker startup fails

Use local `npm run dev` first. Docker Compose is present, but the production Docker path should be validated separately before relying on it for deployment.

---

## AI Voice Assistant (Realtime Conversation)

The tablet ships a resident voice assistant (`VoiceAssistant.svelte`, mounted on all non-login pages via `+layout.svelte`). Pipeline:

1. **Capture** — `MediaRecorder` + wake word (`wake-detector.ts`) + end-of-speech silence detection (`silence-vad.ts`).
2. **STT** — `POST /api/stt` → OpenAI `whisper-1` (`verbose_json`, auto language detect), returns `{ text, detected }`.
3. **Conversation (SSE stream)** — `POST /api/conversation` → `orchestrator.streamConversation()`. Claude (`AI_MODEL`, default `claude-sonnet-4-6`) returns one JSON object `{ intent, entities, reply }`; the `reply` field is streamed to the client character-by-character over SSE as it generates (`extractReplyProgress`).
4. **Dispatch** — by `intent` to a domain agent: `order-agent`, `booking-agent` (spa / restaurant / transport), `info-agent`. Agents call the MCP servers over JSON-RPC (`ai/tools/mcp-client.ts`).
5. **TTS** — `POST /api/tts` → OpenAI `tts-1` (voice `nova`), full-clip playback (`utils/tts.ts`).

### Current status & known limitations (branch `feature/aki-realtime-stream`)

| Area | State |
| --- | --- |
| Text reply | Streamed token-by-token over SSE ✅ |
| Voice I/O | **Not streamed** — STT is batch; TTS plays only after the full clip synthesizes |
| Languages | **`en` / `zh` only**; Indonesian is not wired yet (discarded at STT `LANG_MAP`) |
| Model routing | None — a single model handles all languages |
| Business data | **Mock** — e.g. `check_spa_availability` returns hardcoded slots, `create_spa_booking` a mock code (`// TODO: query/INSERT Cakrasoft PMS`) |
| SPA booking paths | The `/spa` touch UI uses its **own** hardcoded time slots, separate from the voice → MCP path |
| Slot validation | `booking-agent` does **not** validate the chosen slot against availability; its confirmation reply is hardcoded English |
| Intent output | Parsed from raw JSON text (`parseRaw`); not yet tool/function-calling |

See [AllStay-SPA-技术方案.html](./docs/AllStay-SPA-技术方案.html) for the SPA-line technical design and implementation plan.

---

## Project Structure

```text
AllStayProject/
  apps/
    tablet/               # SvelteKit tablet app
      src/
        lib/
          ai/             # orchestrator, agents (order/booking/info), tools/mcp-client
          components/     # VoiceAssistant.svelte, VoiceButton.svelte, ...
          services/       # ai-conversation.ts (client STT→SSE→TTS flow)
          utils/          # recorder, silence-vad, wake-detector, tts
          stores/
        routes/
          api/            # stt, tts, conversation, spa, booking, order, ...
        types/
    mcp-servers/          # MCP server workspace
      packages/
        dining/
        spa/
        restaurant/
        transport/
        shared/
  packages/
    shared-types/
  docs/
  scripts/
  docker-compose.yml
  package.json
  .env.example
```

---

## Development Workflow

See [github_workflow_guideline.md](./github_workflow_guideline.md).
