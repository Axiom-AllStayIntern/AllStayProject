# AllStay

Hotel tablet service system — a full-stack SvelteKit application with an MCP server cluster.

**Tech stack:** SvelteKit · TypeScript · Svelte Stores · Anthropic SDK · MCP · Redis · MySQL · Docker

**Language:** English | [中文](./README.zh-CN.md)

---

## Contents

- [Quick Start (Frontend Development)](#-quick-start-frontend-development)
- [Full Local Environment](#-full-local-environment-with-mcp-servers)
- [What You Can Test Right Now](#-what-you-can-test-right-now)
- [Temporarily Skipped](#-temporarily-skipped)
- [Project Structure](#-project-structure)
- [Environment Variables](#️-environment-variables)
- [One-Command Docker Startup](#-one-command-docker-startup)
- [Development Workflow](#development-workflow)

---

## 🚀 Quick Start (Frontend Development)

> **Minimum requirements:** Node.js 20+ only. No database, Redis, or Docker required.

### Step 1: Install dependencies

```bash
cd apps/tablet
npm install
```

### Step 2: Configure environment variables

```bash
cp ../../.env.example .env
# You can leave every value empty for the first local run
```

### Step 3: Start the development server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### What you can see immediately

| Route | Content | Notes |
|------|------|------|
| `/login` | Staff login page with numeric keypad | Any Staff ID + 4-6 digit PIN will work |
| `/room-select` | Room number input | Enter any 3-4 digit number |
| `/home` | Home page with 4 feature entries | Fully usable |
| `/dining` | Dining category list | Requires an MCP connection (see mock setup below) |
| `/spa` | SPA service list | Same as above |
| `/cart` | Cart page | Store is implemented and the UI is fully usable |
| `/amenities` | Hotel amenities with static data | **Fully usable without MCP** |
| `/explore` | Explore Bali hub page | Fully usable |

---

## 🔧 Full Local Environment (with MCP Servers)

### Prerequisites

- Node.js 20+
- Docker Desktop (for Redis)
- Optional: MySQL (Cakrasoft PMS database, planned for Sprint 2)

### Steps

```bash
# 1. Install all workspace dependencies from the repository root
npm install

# 2. Start Redis (Docker only, no full compose stack required)
docker run -d -p 6379:6379 redis:7-alpine

# 3. Configure environment variables
cp .env.example apps/tablet/.env
# Edit apps/tablet/.env and set:
#   ANTHROPIC_API_KEY=sk-ant-... (required for AI chat)
#   REDIS_URL=redis://localhost:6379

# 4. Start MCP servers (open each command in a separate terminal)
cd apps/mcp-servers/packages/dining && npm install && npx ts-node src/index.ts
cd apps/mcp-servers/packages/spa    && npm install && npx ts-node src/index.ts
cd apps/mcp-servers/packages/restaurant && npm install && npx ts-node src/index.ts
cd apps/mcp-servers/packages/transport  && npm install && npx ts-node src/index.ts

# 5. Start the tablet application
cd apps/tablet && npm run dev
```

### MCP server health checks

```bash
curl http://localhost:3001/health  # dining
curl http://localhost:3002/health  # spa
curl http://localhost:3003/health  # restaurant
curl http://localhost:3004/health  # transport
```

---

## ✅ What You Can Test Right Now

### 1. Login + room selection flow

Visit `/login` → enter any Staff ID such as `S001` → enter any 4-6 digit PIN → get redirected to `/room-select` → enter a room number such as `301` → arrive at the home page.

**What to verify:**
- Numeric keypad interaction
- Route guards (`/home` redirects back to `/login` if accessed directly)
- `RoomNumber` display in the header

### 2. Cart store

Test in the browser console:

```javascript
// Open DevTools and navigate to /cart
// The cart store automatically merges duplicate items

// Test API:
fetch('/api/cart', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'add',
    roomId: '301',
    itemId: 'item-001',
    quantity: 2,
    specialInstructions: 'less spicy'
  })
}).then(r => r.json()).then(console.log)
```

### 3. AI conversation endpoint (requires `ANTHROPIC_API_KEY`)

```bash
curl -X POST http://localhost:5173/api/conversation \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Please add one fried rice, less spicy",
    "roomId": "301",
    "language": "en"
  }'
```

Expected response:

```json
{
  "reply": "Fried rice (less spicy) has been added to your cart...",
  "intent": "order"
}
```

### 4. Idle screensaver

After entering any page, open the console and run:

```javascript
// Trigger the screensaver manually instead of waiting 5 minutes
import { idle } from '/src/lib/stores/idle.ts'
idle.triggerScreensaver?.()
```

Or change the timeout in `src/lib/stores/idle.ts` to `10 * 1000` (10 seconds) for testing.

### 5. Language switching

Click the `EN / 中` button on the right side of the header to switch all page text to Chinese.

---

## ⏭️ Temporarily Skipped

These foundations are already in place, but they still need real data sources before they become fully functional:

| Feature | Status | Unlock condition |
|------|------|---------|
| Menu data display | Framework ready | Connect the Cakrasoft PMS database |
| Real SPA availability | Framework ready | PMS database |
| Restaurant list | Framework ready | PMS database |
| Transport options | **Mock data available** | Ready to run now |
| Order printing | Framework ready | Configure printer IP |
| Capacitor persistence | Framework ready | Package as an Android APK |

---

## 📁 Project Structure

```text
allstay/
├── apps/
│   ├── tablet/               # SvelteKit tablet app (frontend + BFF)
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── ai/       # AI orchestration layer (orchestrator + agents)
│   │       │   ├── components/  # 11 UI components
│   │       │   └── stores/   # 5 Svelte stores
│   │       ├── routes/       # Pages + API endpoints
│   │       └── types/        # TypeScript types
│   │
│   └── mcp-servers/          # MCP server cluster
│       └── packages/
│           ├── shared/       # Database / Redis / printer utilities
│           ├── dining/       # :3001 — dining
│           ├── spa/          # :3002 — spa
│           ├── restaurant/   # :3003 — restaurant
│           └── transport/    # :3004 — transport
│
├── packages/shared-types/    # Cross-package type definitions
├── docs/architecture.md      # Architecture diagram
├── docker-compose.yml        # One-command production deployment
└── scripts/
    ├── build.sh
    └── deploy.sh
```

---

## ⚙️ Environment Variables

| Variable | Required | Description |
|------|------|------|
| `ANTHROPIC_API_KEY` | Required for AI features | Obtain from console.anthropic.com |
| `AI_MODEL` | No | Defaults to `claude-sonnet-4-6` |
| `MCP_DINING_URL` | No | Defaults to `http://localhost:3001` |
| `MCP_SPA_URL` | No | Defaults to `http://localhost:3002` |
| `MCP_RESTAURANT_URL` | No | Defaults to `http://localhost:3003` |
| `MCP_TRANSPORT_URL` | No | Defaults to `http://localhost:3004` |
| `REDIS_URL` | Required for cart features | Defaults to `redis://localhost:6379` |
| `DB_HOST/USER/PASSWORD` | Required for PMS data | Planned for Sprint 2 integration |
| `SESSION_SECRET` | Required in production | Random string used for cookie signing |
| `PRINTER_IP` | Required for printing | Kitchen printer IP |

---

## 🐳 One-Command Docker Startup

```bash
# Make sure .env exists (copy it from .env.example and fill in the values)
cp .env.example .env

# Start all services
docker compose up -d

# View logs
docker compose logs -f tablet
docker compose logs -f mcp-dining
```

Open [http://localhost:3000](http://localhost:3000).

---

## Development Workflow

See [github_workflow_guideline.md](./github_workflow_guideline.md).
