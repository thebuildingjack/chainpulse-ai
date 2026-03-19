# SKILLS.md — Repo Map for AI Agents

This file provides a structured map of the ChainPulse AI codebase for AI coding assistants.

## Critical Files (Start Here)

| File | Purpose | Complexity |
|------|---------|------------|
| `packages/shared/src/policy/engine.ts` | **THE GUARDRAILS** — every action passes through here | High |
| `apps/api/src/agent/agentLoop.ts` | **THE BRAIN LOOP** — end-to-end agent run orchestration | High |
| `apps/api/src/agent/aiPipeline.ts` | AI inference + structured output validation | High |
| `apps/api/src/tools/solanaTools.ts` | All on-chain data fetching + signal computation | High |
| `packages/shared/src/validators/index.ts` | All Zod schemas — source of truth for data shapes | High |

## Auth Flow
- `apps/api/src/auth/router.ts` — SIWS implementation (nonce, verify, JWT)
- `apps/api/src/middleware/auth.ts` — JWT middleware
- `apps/web/src/components/providers/AuthProvider.tsx` — Client-side auth context

## Database
- `apps/api/prisma/schema.prisma` — All models
- `apps/api/src/db/client.ts` — Prisma singleton
- `apps/api/prisma/seed.ts` — Demo data

## API Routers
- `apps/api/src/sessions/router.ts` — Session CRUD
- `apps/api/src/agent/router.ts` — run-once, start, stop
- `apps/api/src/insights/router.ts` — Insight queries
- `apps/api/src/actions/router.ts` — Action management + execution
- `apps/api/src/index.ts` — Express app + middleware setup

## On-Chain Tools
- `apps/api/src/tools/solanaTools.ts` — getWalletBalances, getRecentTransactions, getTokenAccounts, getJupiterQuote, getTokenMetadata, computeSignals
- `apps/api/src/tools/jupiterExecute.ts` — Jupiter swap execution pipeline

## Agent System
- `apps/api/src/agent/scheduler.ts` — Cron scheduler
- `apps/api/src/agent/tokenGate.ts` — DeAura token tier check

## Frontend Pages
- `apps/web/src/app/page.tsx` — Dashboard (main page)
- `apps/web/src/app/watchlist/page.tsx` — Watchlist management
- `apps/web/src/app/actions/page.tsx` — Action feed
- `apps/web/src/app/settings/guardrails/page.tsx` — Guardrail settings
- `apps/web/src/app/agents/[sessionId]/page.tsx` — Session + audit log

## Frontend Components
- `apps/web/src/components/agent/InsightCard.tsx` — Insight display
- `apps/web/src/components/agent/ActionCard.tsx` — Action display + approve/execute
- `apps/web/src/components/ui/Navbar.tsx` — Navigation
- `apps/web/src/components/providers/WalletProvider.tsx` — Solana wallet context
- `apps/web/src/components/providers/AuthProvider.tsx` — Auth state
- `apps/web/src/lib/api.ts` — Typed API client

## Types & Validators
- `packages/shared/src/types/index.ts` — All TypeScript types
- `packages/shared/src/validators/index.ts` — All Zod schemas
- `packages/shared/src/policy/engine.ts` — Policy check function

## Configuration
- `.env.example` — All environment variables documented
- `apps/api/prisma/schema.prisma` — Database schema
- `apps/web/tailwind.config.js` — UI theme + colors
- `apps/web/next.config.js` — Next.js config + API proxy

## Key Patterns

### Adding a new signal type:
1. Add type to `InsightType` in `packages/shared/src/types/index.ts`
2. Implement computation in `computeSignals()` in `apps/api/src/tools/solanaTools.ts`
3. Add icon + style in `apps/web/src/components/agent/InsightCard.tsx`

### Adding a new action type:
1. Add to `ActionType` in types
2. Add Zod schema in validators
3. Add policy check branch in `packages/shared/src/policy/engine.ts`
4. Add execution branch in `apps/api/src/actions/router.ts`
5. Add display in `ActionCard.tsx`

### Changing AI model:
- Set `AI_PROVIDER` and `AI_MODEL` in `.env`
- The `runAgentInference()` function in `aiPipeline.ts` handles both `anthropic` and `openai` providers

### Adding a new route:
1. Create router in `apps/api/src/`
2. Register in `apps/api/src/index.ts`
3. Add to `apps/web/src/lib/api.ts` typed helper
