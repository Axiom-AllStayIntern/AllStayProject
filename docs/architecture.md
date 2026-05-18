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

## Key Design Decisions

- **SvelteKit as BFF**: The tablet app acts as a Backend-for-Frontend, proxying all MCP calls so the client never talks directly to MCP servers.
- **Redis for cart**: Cart state is stored in Redis (TTL 1h) keyed by `cart:{roomId}`. This handles multi-session scenarios.
- **AI embedded in SvelteKit**: For Phase 1–3, the orchestrator runs inside SvelteKit server routes. Phase 4 extracts this.
- **Stateless MCP servers**: Each MCP server is stateless — all state lives in Redis or the PMS database.
- **ESC/POS printing**: Kitchen receipt printing happens directly from the Dining MCP server over TCP.
