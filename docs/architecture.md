# AllStay Architecture

## Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Tablet (SvelteKit)                    │
│  UI Pages → BFF API Routes → AI Orchestrator            │
└────────────────────────┬────────────────────────────────┘
                         │ JSON-RPC 2.0 / HTTP
        ┌────────────────┼────────────────────┐
        ▼                ▼                    ▼
  ┌──────────┐    ┌──────────┐    ┌──────────────────┐
  │  Dining  │    │   Spa    │    │ Restaurant/Trans  │
  │ MCP :3001│    │ MCP :3002│    │   MCP :3003/3004  │
  └────┬─────┘    └────┬─────┘    └────────┬─────────┘
       │               │                   │
       └───────────────┼───────────────────┘
                       ▼
              ┌────────────────┐
              │  Cakrasoft PMS │
              │  (MySQL/PG)    │
              └────────────────┘
                       +
              ┌────────────────┐
              │     Redis      │
              │  (Cart Cache)  │
              └────────────────┘
```

## AI orchestration layer (`apps/tablet/src/lib/ai`)

```
 guest utterance
      │
      ▼
 orchestrator ──(classify: forced tool_choice → {intent, entities, reply})── Claude
      │                                                     ▲
      │  guest health/faith entities → spaSession.mergeGuest (accumulates across turns)
      ▼
 dispatch by intent ──► specialist agents (order / booking / spa / info)
      │                          │
      │                          ├─ curation: buildCurationContext()
      │                          │     register (L1) + cultural KB (L2, incl. id) +
      │                          │     glossary (canonical terms + locks) + few-shot
      │                          └─ constraints: validateBooking()  ← BLOCKS before proposing
      ▼
 llm-gateway.phraseReply()  (only when lang=id & PHRASE_MODEL≠off)
      │   Claude draft ──► SEA-LION/Sahabat-AI re-voices ──► verify gate (locks + numbers)
      │                                                          └─ fail → fall back to draft
      ▼
   final reply
```

- **Model router** (`llm-gateway.ts` + `providers/`): reasoning & tool-calling always on Claude; native-Indonesian *phrasing* routes to SEA-LION (OpenAI-compatible) / a mock / off. Providers isolate SDK details; `PHRASE_MODEL` selects the backend.
- **Curation** (`curation/`): a curated corpus (glossary + cultural KB + few-shot) injected consistently, with terminology **locks** the phrase gate can verify — what makes this more than a translation agent.
- **Constraint layer** (`constraints/` + spa MCP `constraints.ts`): halal/contraindication/Nyepi/party-size checked in **code**, twice — the tablet refuses before proposing, and the MCP server refuses before writing (defense in depth; the server never trusts the client).
- **Evaluation** (`evals/runner`): drives the live pipeline over HTTP and scores task-completion + content-accuracy (deterministic) + cultural (LLM-judge), producing real before/after numbers per config.

## Key Design Decisions

- **SvelteKit as BFF**: The tablet app acts as a Backend-for-Frontend, proxying all MCP calls so the client never talks directly to MCP servers.
- **Redis for cart**: Cart state is stored in Redis (TTL 1h) keyed by `cart:{roomId}`. This handles multi-session scenarios.
- **AI embedded in SvelteKit**: For Phase 1–3, the orchestrator runs inside SvelteKit server routes. Phase 4 extracts this.
- **Stateless MCP servers**: Each MCP server is stateless — all state lives in Redis or the PMS database.
- **ESC/POS printing**: Kitchen receipt printing happens directly from the Dining MCP server over TCP.
