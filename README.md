# ChainPulse AI 🤖⛓️

> **A Solana Opportunity Agent that spots signals, explains the why, and executes safely within your rules.**

Built for the **Buildifi AI Track** — an end-to-end AI agent loop on Solana devnet with strict guardrails, auditable history, and safe on-chain execution.

[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF?logo=solana)](https://solana.com)
[![AI Powered](https://img.shields.io/badge/AI-Claude%20%2F%20GPT--4o-14F195)](https://anthropic.com)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black?logo=next.js)](https://nextjs.org)

---

## What It Does

ChainPulse AI runs an **autonomous agent loop** that:

1. **Monitors** your Solana wallet + watched tokens on a schedule
2. **Computes 5 signal types** from on-chain data (momentum, volume spikes, route quality, whale activity, new tokens)
3. **Calls an AI model** (Claude / GPT-4o) with structured on-chain snapshots
4. **Generates JSON-validated insights** with confidence scores and evidence
5. **Proposes safe actions** (Jupiter swaps, notifications, transfers) bounded by your guardrails
6. **Executes or queues** actions — only 1 auto-execution per loop, with full audit trail

---

## Architecture Overview

```
┌─────────────┐     sign-in      ┌─────────────────────────────────┐
│  Next.js UI │ ◄──────────────► │          Express API             │
│  (port 3000)│     REST+cookie  │          (port 4000)             │
└─────────────┘                  └──────┬──────────────────┬────────┘
                                         │                  │
                                  ┌──────▼──────┐   ┌──────▼──────┐
                                  │ Agent Loop  │   │  SQLite DB  │
                                  │ (Scheduler) │   │  (Prisma)   │
                                  └──────┬──────┘   └─────────────┘
                                         │
                          ┌──────────────┼──────────────┐
                          │              │              │
                   ┌──────▼─────┐ ┌─────▼──────┐ ┌────▼──────┐
                   │  Solana    │ │  Jupiter   │ │  Claude/  │
                   │  RPC       │ │  Quote API │ │  GPT-4o   │
                   │  Devnet    │ │            │ │  (AI)     │
                   └────────────┘ └────────────┘ └───────────┘
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- npm 9+

### 1. Clone & Install

```bash
git clone https://github.com/yourname/chainpulse-ai
cd chainpulse-ai
npm install
```

### 2. Configure environment

```bash
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local
cp .env.example apps/worker/.env
```

Edit `apps/api/.env` with your values:
```bash
AI_API_KEY=your_anthropic_or_openai_key
SESSION_JWT_SECRET=$(openssl rand -hex 64)
# All other defaults work for devnet demo
```

### 3. Initialize database

```bash
cd apps/api
npx prisma db push        # Creates SQLite DB + schema
npx ts-node prisma/seed.ts # Seeds demo data
```

### 4. Start all services

```bash
# From repo root — starts API + Frontend + Worker concurrently
npm run dev
```

Or start individually:
```bash
npm run dev:api     # API on :4000
npm run dev:web     # Frontend on :3000
npm run dev:worker  # Background worker
```

### 5. Open the app

Visit [http://localhost:3000](http://localhost:3000)

1. Connect a Solana devnet wallet (Phantom recommended)
2. Click **Sign In** — sign the authentication message (no SOL cost)
3. Click **Create Session** — starts monitoring your wallet
4. Click **▶ Run Agent Now** — triggers immediate AI analysis
5. View insights on dashboard, approve/reject actions in the Actions tab

---

## Demo Mode

A seeded demo session is available at `/agents/demo-session-001` without wallet connection. It shows:
- 3 pre-generated insights (Momentum, Route Quality, Volume Spike)
- 1 executed NOTIFY action
- 1 PENDING_APPROVAL Jupiter swap proposal
- Full audit log with tool call records

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/nonce` | Get sign-in challenge |
| POST | `/auth/verify` | Verify signature → JWT cookie |
| GET | `/auth/me` | Check session status |
| POST | `/sessions` | Create agent session |
| GET | `/sessions` | List user's sessions |
| GET | `/sessions/:id` | Session detail + run history |
| PATCH | `/sessions/:id` | Update preferences |
| PATCH | `/sessions/:id/guardrails` | Update guardrails |
| POST | `/agent/run-once?sessId=` | Manual agent trigger |
| POST | `/agent/start` | Start background scheduler |
| POST | `/agent/stop` | Stop scheduler |
| GET | `/insights?sessId=` | List insights |
| GET | `/actions?sessId=&status=` | List actions |
| POST | `/actions/:id/approve` | Approve pending action |
| POST | `/actions/:id/reject` | Reject pending action |
| POST | `/actions/:id/execute` | Execute approved action |

---

## Environment Variables

See [.env.example](.env.example) for full documentation of all variables.

Key variables:
| Variable | Required | Description |
|----------|----------|-------------|
| `AI_API_KEY` | ✅ | Anthropic or OpenAI API key |
| `AI_PROVIDER` | ✅ | `anthropic` or `openai` |
| `SESSION_JWT_SECRET` | ✅ | Random secret for JWT signing |
| `SOLANA_RPC_URL` | ✅ | Solana RPC (devnet default) |
| `TOKEN_GATE_MOCK` | | `true` for mock token gating |
| `DEAURA_TOKEN_LINK` | | DeAura token URL placeholder |

---

## DeAura Token

DeAura token link: **[DEAURA_TOKEN_LINK]**

See [TOKEN_UTILITY.md](docs/TOKEN_UTILITY.md) for token utility design and [PITCH.md](docs/PITCH.md) for launch plan.

To satisfy the $200k volume requirement outside of code:
1. List DeAura on a Solana DEX (Raydium, Orca, or Meteora recommended)
2. Announce via official channels with transparent market-making
3. See [PITCH.md](docs/PITCH.md) for community growth strategy
4. **Never engage in wash trading or artificial volume** — violates DEX ToS and hackathon rules

---

## Project Structure

```
chainpulse-ai/
├── apps/
│   ├── api/                    # Express + Prisma backend
│   │   ├── prisma/             # Schema + migrations + seed
│   │   └── src/
│   │       ├── auth/           # Sign-in with Solana
│   │       ├── sessions/       # Agent session CRUD
│   │       ├── agent/          # Loop, scheduler, AI pipeline, token gate
│   │       ├── tools/          # Solana tools + Jupiter execution
│   │       ├── insights/       # Insight retrieval
│   │       ├── actions/        # Action management + execution
│   │       └── middleware/     # Auth, error handling
│   ├── web/                    # Next.js 14 App Router frontend
│   │   └── src/
│   │       ├── app/            # Pages (dashboard, watchlist, actions, settings)
│   │       ├── components/     # UI components, providers
│   │       └── lib/            # API client
│   └── worker/                 # Standalone worker process
└── packages/
    └── shared/                 # Types, Zod validators, policy engine
        └── src/
            ├── types/          # All domain types
            ├── validators/     # Zod schemas
            └── policy/         # Guardrails engine
```

---

## Reused Code

See [REUSED_CODE.md](docs/REUSED_CODE.md) for full disclosure.

---

## Security

See [SECURITY.md](docs/SECURITY.md) for threat model and mitigations.
