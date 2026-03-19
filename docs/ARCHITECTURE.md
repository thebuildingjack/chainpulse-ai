# ChainPulse AI — Architecture

## System Overview

ChainPulse AI is a monorepo containing three deployable services and one shared package:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ChainPulse AI System                              │
│                                                                             │
│  ┌──────────────────┐   HTTP/REST    ┌────────────────────────────────────┐ │
│  │   apps/web       │◄─────────────►│         apps/api                   │ │
│  │   Next.js 14     │   + cookies   │   Express + TypeScript             │ │
│  │   Tailwind CSS   │               │                                    │ │
│  │   Wallet Adapter │               │  ┌──────────────────────────────┐  │ │
│  └──────────────────┘               │  │   Auth (SIWS)                │  │ │
│                                     │  │   Sessions CRUD              │  │ │
│  ┌──────────────────┐               │  │   Agent Runner               │  │ │
│  │   apps/worker    │──────────────►│  │   Insights / Actions API     │  │ │
│  │   Node.js cron   │  trigger run  └──────────────────────────────┘  │ │
│  └──────────────────┘               │                                    │ │
│                                     │  ┌────────────┐ ┌───────────────┐  │ │
│  ┌──────────────────┐               │  │  SQLite    │ │  Snapshot     │  │ │
│  │ packages/shared  │◄──────────────│  │  (Prisma)  │ │  Cache        │  │ │
│  │  Types           │               │  └────────────┘ └───────────────┘  │ │
│  │  Zod validators  │               └────────────────────────────────────┘ │
│  │  Policy engine   │                              │                        │
│  └──────────────────┘                              │                        │
│                                                    │                        │
│              ┌─────────────────────────────────────▼───────────────────┐   │
│              │                  External Services                        │   │
│              │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │   │
│              │  │  Solana RPC  │  │ Jupiter API  │  │  Claude/GPT   │  │   │
│              │  │  (devnet)    │  │  (quote/swap)│  │  Inference    │  │   │
│              │  └──────────────┘  └──────────────┘  └───────────────┘  │   │
│              └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Loop Flow

```
Scheduler (every N min)
        │
        ▼
┌───────────────────┐
│ Load active       │
│ sessions due      │◄── Checks nextRunAt <= now
└───────┬───────────┘
        │  for each session
        ▼
┌───────────────────┐
│  Create AgentRun  │◄── status: RUNNING
│  record           │
└───────┬───────────┘
        │
        ▼
┌────────────────────────────────────────┐
│           TOOL PHASE                   │
│  1. getWalletBalances(pubkey)          │
│  2. getRecentTransactions(pubkey, 15)  │
│  3. getJupiterQuote(SOL→watchlist[])   │
│  4. computeSignals(curr, prev)         │
│  All tool calls logged to ToolCallLog  │
└───────┬────────────────────────────────┘
        │
        ▼
┌───────────────────┐
│  Load prev        │
│  snapshot cache   │
│  + prev insight   │
│  titles           │
└───────┬───────────┘
        │
        ▼
┌────────────────────────────────────────┐
│            AI PHASE                    │
│  Build structured prompt:              │
│  - Snapshot data                       │
│  - Signal scores + evidence            │
│  - Session preferences                 │
│  - Guardrails                          │
│  → Call Claude/GPT-4o                  │
│  → Parse JSON                          │
│  → Validate with Zod                   │
└───────┬────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────┐
│         PERSIST INSIGHTS               │
│  Store each insight with:              │
│  - type, severity, confidence          │
│  - evidence[], recommendedNext         │
└───────┬────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────┐
│         POLICY PHASE                   │
│  For each recommendedAction:           │
│  1. Validate schema (Zod)              │
│  2. Check permissionsMode              │
│  3. Check allowedOutputMints           │
│  4. Check slippage cap                 │
│  5. Check per-tx SOL cap              │
│  6. Check daily spend cap              │
│  7. Check destination allowlist        │
│  8. Check approval threshold           │
│  → approved / requiresHumanApproval   │
└───────┬────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────┐
│        EXECUTION PHASE                 │
│  If EXECUTE_LIMITED + approved:        │
│    → executeJupiterSwap (at most 1)    │
│    → Track daily spend                 │
│  If requiresHumanApproval:             │
│    → status = PENDING_APPROVAL         │
│  If policy rejected:                   │
│    → status = SKIPPED_POLICY           │
│  Persist all with full audit data      │
└───────┬────────────────────────────────┘
        │
        ▼
┌───────────────────┐
│  Update cache,    │
│  session timing,  │
│  finalize run     │◄── status: COMPLETED
└───────────────────┘
```

---

## Jupiter Swap Flow (Two-Phase)

```
1. QUOTE PHASE
   GET /v6/quote?inputMint=SOL&outputMint=X&amount=N&slippageBps=300
   → Returns routePlan, outAmount, priceImpactPct

2. SERIALIZE PHASE
   POST /v6/swap { quoteResponse, userPublicKey, wrapAndUnwrapSol: true }
   → Returns base64 VersionedTransaction

3. SIGN PHASE
   VersionedTransaction.deserialize(buffer)
   transaction.sign([keypair])   ← devnet demo key from env

4. SEND + CONFIRM
   conn.sendRawTransaction(serialized, { skipPreflight: false })
   conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight })

5. AUDIT
   Store txSignature + explorerLink in AgentAction record
```

---

## Policy Engine

All actions pass through `packages/shared/src/policy/engine.ts` before execution.

```
checkPolicy(ctx: PolicyContext) → PolicyResult
  ├── READ_ONLY? → block all non-NOTIFY
  ├── Unknown actionType? → reject
  ├── JUPITER_SWAP checks:
  │   ├── Zod schema validation
  │   ├── outputMint in allowedOutputMints?
  │   ├── slippageBps <= slippageBpsMax?
  │   ├── amountSol <= maxSwapSolPerTx?
  │   ├── dailySpend + amount <= maxSpendSolPerDay?
  │   └── amount > approvalThreshold? → requiresHumanApproval
  ├── TRANSFER checks:
  │   ├── destination in allowedDestinationAddresses?
  │   ├── daily spend cap
  │   └── approval threshold → requiresHumanApproval
  └── NOTIFY checks:
      └── Zod schema validation (always passes if valid)
```

---

## Token Gate Architecture

```
getTokenGate(walletAddress)
  │
  ├── MOCK_MODE=true → return BASE tier (MVP/demo)
  │
  └── MOCK_MODE=false:
      ├── Fetch token accounts for walletAddress
      ├── Find DeAura mint balance
      ├── balance >= 500 → EXECUTION tier (3min loop, canExecute)
      ├── balance >= 100 → PREMIUM tier (3min loop, no execute)
      └── balance < 100  → BASE tier (15min loop, read-only)
```

---

## Database Schema (SQLite via Prisma)

```
User
  id, walletAddress (unique), createdAt

AuthNonce
  id, walletAddress, nonce (unique), expiresAt, used

AgentSession
  id, userId, walletAddress
  watchlistMints (JSON), watchlistPrograms (JSON)
  timeframe, riskLevel, permissionsMode
  guardrails (JSON), isActive
  loopIntervalMinutes, lastRunAt, nextRunAt

AgentRun
  id, sessionId, startedAt, completedAt, status
  snapshotData (JSON), aiOutputRaw, toolCallLog (JSON)
  errorMessage

Insight
  id, sessionId, runId
  title, type, severity, confidence
  summary, evidence (JSON), recommendedNext

AgentAction
  id, sessionId, runId
  actionType, risk, params (JSON)
  reason, status
  policyDecision (JSON), txSignature, explorerLink
  failureReason

DailySpend
  sessionId, date (YYYY-MM-DD), spentSol
  [unique: sessionId+date]

SnapshotCache
  sessionId (unique), snapshotJson, capturedAt
```

---

## Auth Flow (Sign-In with Solana)

```
Client                              API
  │                                   │
  │── POST /auth/nonce ──────────────►│
  │   { walletAddress }               │── Create nonce (UUID)
  │                                   │── Store with 5min TTL
  │◄── { nonce, message } ───────────│
  │                                   │
  │ wallet.signMessage(message bytes) │
  │                                   │
  │── POST /auth/verify ─────────────►│
  │   { walletAddress,                │── Load nonce record
  │     signature (base58),           │── Verify not used/expired
  │     nonce }                       │── nacl.sign.detached.verify()
  │                                   │── Mark nonce used
  │◄── { success, userId } + cookie ─│── Issue JWT (7d)
  │                                   │
  │ All subsequent requests           │
  │── Cookie: cp_token ──────────────►│── jwt.verify()
```

---

## Signal Computation

Five signal types computed in `tools/solanaTools.ts::computeSignals()`:

| Signal | Source Data | Score Formula |
|--------|-------------|---------------|
| MOMENTUM | SOL balance delta vs previous snapshot | `min(|changePct| / 20, 1)` |
| VOLUME_SPIKE | Recent tx count | `min(txCount / 20, 1)` |
| ROUTE_QUALITY | Jupiter quote availability | `availableRoutes / totalRoutes` |
| WHALE_ACTIVITY | Tx transfers > 10 SOL | `min(largeTxCount / 3, 1)` |
| NEW_TOKEN | Mints in txs not in known holdings | `min(newMintCount / 5, 1)` |

Each signal includes `confidence` (0-1) and `evidence[]` (human-readable strings) fed to the AI.
