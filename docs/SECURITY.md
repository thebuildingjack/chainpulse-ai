# ChainPulse AI — Security Model

## Threat Model

### Assets to Protect
1. **User wallet funds** — the highest-value asset; agent actions must never drain wallets
2. **User authentication** — prevent unauthorized session access
3. **AI output integrity** — prevent prompt injection / malicious AI outputs
4. **Private keys** — must never be stored in plaintext or logged
5. **API endpoints** — prevent abuse, rate-limit attacks, unauthorized access

---

## Threat Scenarios & Mitigations

### T1: Unauthorized Wallet Actions
**Threat**: Agent executes swaps or transfers without user consent.

**Mitigations**:
- Default mode is `READ_ONLY` — execution physically impossible
- `EXECUTE_LIMITED` requires explicit user toggle
- Policy engine re-runs on every action, including manual executions
- `approvalThresholdSol` routes large actions to PENDING_APPROVAL queue
- At most **1 auto-execution per loop** — limits blast radius
- All actions persisted with full policyDecision audit record
- Two-phase execute: propose → human approve → execute (for above-threshold)

### T2: Private Key Exposure
**Threat**: Signer key leaked via logs, DB, or error messages.

**Mitigations**:
- Private key only stored in `.env` file, never in database
- `DEMO_SIGNER_PRIVATE_KEY` is **devnet only** — production requires user browser signing
- Helmet disables `X-Powered-By`; no stack traces in production responses
- Keys never appear in `ToolCallLog` (params are sanitized before storage)
- `.gitignore` excludes all `.env` files
- **Production path**: user signs transactions in their browser wallet (no server-side key needed)

### T3: Prompt Injection via On-Chain Data
**Threat**: Malicious token name or transaction memo contains instructions to the AI model.

**Mitigations**:
- AI output is **strictly validated with Zod schema** — any injected JSON fields are ignored
- System prompt explicitly states: "You MUST output ONLY valid JSON matching the exact schema"
- Evidence strings are passed as data, not as system instructions
- AI model cannot call arbitrary tools — only a closed set defined in code
- Invalid AI output falls back to a safe minimal response, not a crash

### T4: Session Hijacking / Auth Bypass
**Threat**: Attacker steals JWT cookie or replays nonce.

**Mitigations**:
- JWT signed with `SESSION_JWT_SECRET` (min 64-char random hex recommended)
- Cookie flags: `httpOnly: true`, `secure: true` (production), `sameSite: lax`
- Nonce is single-use (marked `used: true` after verification)
- Nonce has 5-minute TTL
- `nacl.sign.detached.verify()` verifies ed25519 signature — cannot be forged without private key
- Auth endpoints rate-limited: 10 req/min

### T5: API Abuse / DoS
**Threat**: Automated requests flood the API or trigger excessive AI/RPC calls.

**Mitigations**:
- Write endpoints: 30 req/min rate limit (express-rate-limit)
- Auth endpoints: 10 req/min
- Agent run-once requires authenticated session ownership check
- AI calls are bounded: 1 call per agent run, not per request
- RPC failures fall back to cached snapshot — no infinite retry loops

### T6: Guardrail Bypass
**Threat**: Malicious session configuration sets guardrails to allow unlimited spending.

**Mitigations**:
- `GuardrailsSchema` (Zod) enforces hard limits at the validator level:
  - `maxSpendSolPerDay` capped at 100 SOL
  - `maxSwapSolPerTx` capped at 10 SOL
  - `slippageBpsMax` capped at 5000 bps (50%)
- Policy engine checks both user-set guardrails AND schema-validated limits
- Actions above `approvalThresholdSol` always require human approval regardless of mode
- Daily spend tracking persisted in DB and checked before every execution

### T7: Supply Chain / Dependency Attack
**Threat**: Malicious npm package compromises the app.

**Mitigations**:
- Use locked `package-lock.json` (committed to git)
- Minimal dependency set (no unused packages)
- All external HTTP calls use `AbortSignal.timeout()` to prevent hanging
- Jupiter and RPC responses validated before use

---

## Security Controls Summary

| Control | Implementation |
|---------|---------------|
| Auth | JWT + ed25519 SIWS, single-use nonces |
| Transport | HTTPS in production, CORS restricted to known origin |
| Headers | Helmet (CSP, HSTS, X-Frame, etc.) |
| Rate Limiting | express-rate-limit on all write endpoints |
| Input Validation | Zod schemas on all API inputs |
| Output Validation | Zod schema on all AI outputs |
| Policy Engine | Double-checks every action before execution |
| Audit Trail | Full ToolCallLog + policyDecision stored per action |
| Key Management | .env only, never DB, never logs |
| Execution Limit | Max 1 auto-execution per agent loop |
| Human-in-the-Loop | approvalThresholdSol routes to PENDING_APPROVAL |
| Fallback | Snapshot cache on RPC failure; minimal valid AI fallback |

---

## Production Hardening Checklist

Before deploying to mainnet:

- [ ] Replace `DEMO_SIGNER_PRIVATE_KEY` with browser-wallet signing (user signs in frontend)
- [ ] Set `SESSION_JWT_SECRET` to cryptographically random 64-char hex
- [ ] Set `NODE_ENV=production` (disables detailed error messages)
- [ ] Enable HTTPS + set `secure: true` on cookies
- [ ] Replace SQLite with PostgreSQL
- [ ] Add proper logging (no secrets) with Pino or Winston
- [ ] Set up monitoring/alerting on agent run failures
- [ ] Add API key rotation mechanism
- [ ] Conduct dependency audit: `npm audit`
- [ ] Review and tighten CORS origin list
- [ ] Add IP-based rate limiting at load balancer level
- [ ] Enable Solana mainnet RPC (use a private endpoint, not public)

---

## Responsible Disclosure

If you discover a security vulnerability, please email: security@chainpulse.ai (placeholder)

Do not disclose publicly until a fix is deployed.
