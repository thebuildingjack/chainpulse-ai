# Reused Code Disclosure

This document discloses all third-party code, libraries, and references used in ChainPulse AI, in accordance with Buildifi hackathon rules.

---

## Open Source Libraries (All Licensed for Commercial Use)

All dependencies are listed in `package.json` files. Key ones:

| Package | License | Usage |
|---------|---------|-------|
| `@solana/web3.js` | Apache-2.0 | Solana RPC interaction |
| `@solana/spl-token` | Apache-2.0 | SPL token account queries |
| `@solana/wallet-adapter-*` | Apache-2.0 | Wallet connection UI |
| `tweetnacl` | Public Domain | Ed25519 signature verification |
| `bs58` | MIT | Base58 encoding/decoding |
| `prisma` | Apache-2.0 | Database ORM |
| `express` | MIT | HTTP server |
| `next` | MIT | React framework |
| `tailwindcss` | MIT | CSS utility framework |
| `zod` | MIT | Schema validation |
| `jsonwebtoken` | MIT | JWT creation/verification |
| `helmet` | MIT | HTTP security headers |
| `express-rate-limit` | MIT | Rate limiting |
| `node-cron` | MIT | Scheduled tasks |

---

## Code Written From Scratch for This Hackathon

The following are **original implementations** written specifically for ChainPulse AI:

1. **Policy Engine** (`packages/shared/src/policy/engine.ts`) — fully original guardrails logic
2. **Agent Loop** (`apps/api/src/agent/agentLoop.ts`) — fully original autonomous loop design
3. **AI Pipeline** (`apps/api/src/agent/aiPipeline.ts`) — fully original prompt design and validation
4. **Signal Computation** (`apps/api/src/tools/solanaTools.ts::computeSignals`) — fully original
5. **Token Gate** (`apps/api/src/agent/tokenGate.ts`) — fully original
6. **SIWS Auth** (`apps/api/src/auth/router.ts`) — original implementation of the SIWS spec
7. **All Zod validators** (`packages/shared/src/validators/index.ts`) — fully original
8. **All UI components** (`apps/web/src/components/`) — fully original
9. **All page layouts** (`apps/web/src/app/`) — fully original
10. **All documentation** — fully original

---

## Patterns / Concepts Referenced

The following patterns were referenced from public documentation but implemented from scratch:

| Pattern | Source | What We Used |
|---------|--------|-------------|
| SIWS (Sign-In with Solana) | [solana.com/developers](https://solana.com/developers) | Spec for nonce-based auth |
| Jupiter Swap API | [station.jup.ag/docs](https://station.jup.ag/docs) | Quote + swap endpoint patterns |
| Wallet Adapter setup | [solana-labs/wallet-adapter](https://github.com/solana-labs/wallet-adapter) | Standard boilerplate |
| Prisma setup | [prisma.io/docs](https://prisma.io/docs) | Standard setup pattern |
| Claude tool calling | [docs.anthropic.com](https://docs.anthropic.com) | System prompt pattern |

---

## AI Assistance Disclosure

This project was developed with AI code assistance (Claude). The architecture, design decisions, security model, and business logic are the original work of the development team. AI tools were used to:
- Accelerate boilerplate generation
- Suggest TypeScript type patterns
- Review code for obvious bugs

All security-critical code (policy engine, auth, key handling) was manually reviewed and designed by the team.

---

## No Reuse of Other Hackathon Projects

This project was built specifically for the Buildifi AI Track hackathon. No code was reused from previous hackathon submissions.
