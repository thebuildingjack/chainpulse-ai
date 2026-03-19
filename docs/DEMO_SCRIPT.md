# ChainPulse AI — 3-Minute Demo Script

## Setup Before Recording
- [ ] Open http://localhost:3000 in Chrome (dark mode, 1920×1080)
- [ ] Have Phantom wallet connected to devnet with some SOL
- [ ] Seed the database: `npx ts-node apps/api/prisma/seed.ts`
- [ ] API + frontend running: `npm run dev`
- [ ] Terminal visible for log output (optional — shows the AI loop working)

---

## Scene 1: The Hook (0:00 – 0:25)

**[Screen: Landing page]**

> "Every Solana trader has missed an opportunity because they weren't watching. Whale moves SOL into a token, price pumps 20%, you check your phone 4 hours later. Gone."

> "ChainPulse AI is an autonomous on-chain agent that watches your wallet and your watchlist 24/7, spots the signals, explains why they matter, and — within the limits you set — can actually act on them."

---

## Scene 2: Connect & Sign In (0:25 – 0:50)

**[Screen: Click "Connect Wallet" → Phantom popup]**

> "We use Sign-In with Solana — just a message signature. No SOL spent, no transaction."

**[Click "Sign In" → Phantom shows message to sign → Click Approve]**

> "Authenticated. JWT session set. The API verifies the ed25519 signature on-chain."

---

## Scene 3: Dashboard & Run Agent (0:50 – 1:30)

**[Screen: Dashboard with session active]**

> "I have an active session watching USDC and my wallet. The agent runs every 15 minutes automatically — but I can trigger it manually."

**[Click "▶ Run Agent Now"]**

> "Watch the terminal — the agent calls getWalletBalances, fetches recent transactions, gets a Jupiter quote for SOL→USDC, computes 5 signal scores, then sends a structured prompt to Claude."

**[Terminal shows tool calls scrolling]**

> "About 3-5 seconds... and here come the insights."

**[Dashboard refreshes with 3 insight cards]**

---

## Scene 4: Insight Deep Dive (1:30 – 2:00)

**[Screen: Focus on one insight card — e.g., Volume Spike HIGH]**

> "Each insight has: a type, a severity badge, a confidence score — this one is 65% — and most importantly, the evidence. Not just 'we think something happened' — it shows you the exact data: 15 transactions, 2 failed, 0.000315 SOL in fees."

> "And a recommended next action in plain English."

**[Hover over confidence bar]**

> "Confidence is honest — on devnet with limited data, the AI caps itself at 0.7. In production with more signal history, confidence improves."

---

## Scene 5: Actions & Guardrails (2:00 – 2:40)

**[Screen: Navigate to /actions]**

> "Here's where it gets interesting. The AI proposed a Jupiter swap — 0.05 SOL for USDC — but it's sitting in PENDING_APPROVAL because it hit my approval threshold."

**[Show action card with policy decision visible]**

> "The policy engine logged every check: allowed mint ✓, slippage under 300bps ✓, amount under per-tx cap ✓ — but amount exceeds my 0.04 SOL approval threshold, so it needs my OK."

**[Click "✓ Approve"]**

> "I approve it. Now..."

**[Click "⚡ Execute On-Chain"]**

> "The policy engine re-runs — defense in depth — and if everything still checks out, it calls Jupiter, serializes the versioned transaction, signs with the devnet wallet, and sends it."

**[Show Solscan link appearing]**

> "Tx signature, live on Solscan devnet. Fully auditable."

---

## Scene 6: Guardrails & Token Gate (2:40 – 3:00)

**[Screen: Navigate to /settings/guardrails]**

> "Everything is configurable. Max 0.1 SOL per swap, 1 SOL per day, only USDC output, 300 bps max slippage. The AI cannot exceed these — ever."

**[Briefly show the EXECUTE_LIMITED toggle]**

> "Execution mode is off by default. Read-only is the default. You turn this on explicitly — and DeAura token holders get full execution capability unlocked."

> "ChainPulse AI. Opportunity on autopilot, safety by design."

---

## Bonus: Audit Log Scene (if time permits)

**[Navigate to /agents/[sessionId] → Audit tab]**

> "Every single run is logged. You can expand any run and see every tool call, the raw AI output, and the policy decision for every proposed action. Full transparency — not a black box."

---

## Key Talking Points Checklist

- [ ] AI loop is autonomous — runs on schedule, not just on demand
- [ ] 5 signal types with evidence and confidence
- [ ] Policy engine enforces limits — AI cannot exceed them
- [ ] Jupiter swap: real on-chain execution on devnet
- [ ] SIWS auth — no password, no email
- [ ] Full audit trail — every tool call logged
- [ ] DeAura token tiers the product
- [ ] READ_ONLY by default — safety first
