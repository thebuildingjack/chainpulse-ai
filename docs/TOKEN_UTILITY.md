# DeAura Token Utility

> DeAura Token Link: **[DEAURA_TOKEN_LINK]**
>
> Replace `[DEAURA_TOKEN_LINK]` with the actual Jupiter/DEX listing URL after token launch.

---

## Token Overview

| Property | Value |
|----------|-------|
| Name | DeAura |
| Symbol | DEAURA |
| Network | Solana (SPL Token) |
| Standard | SPL Token-2022 |
| DEX Link | [DEAURA_TOKEN_LINK] |

---

## Utility Design

DeAura powers three tiers of ChainPulse AI access:

### Tier 1 — BASE (0 DeAura)
- **Loop frequency**: Every 15 minutes
- **Mode**: READ_ONLY only
- **Signals**: 5 core signals
- **Actions**: NOTIFY only
- Available to all wallets — no token required

### Tier 2 — PREMIUM (≥ 100 DeAura)
- **Loop frequency**: Every 3 minutes (5× faster)
- **Mode**: READ_ONLY (with all advanced signals)
- **Signals**: All 5 signals + higher-resolution data
- **Actions**: NOTIFY only
- Priority queue for AI inference
- Historical insight archive (30 days)

### Tier 3 — EXECUTION (≥ 500 DeAura)
- **Loop frequency**: Every 3 minutes
- **Mode**: READ_ONLY or EXECUTE_LIMITED (user choice)
- **Signals**: All signals + whale alert notifications
- **Actions**: JUPITER_SWAP + NOTIFY + TRANSFER (all guarded by policy)
- On-chain execution capability
- Unlimited audit history
- Priority RPC endpoint access

---

## Token Flow

```
User holds DeAura tokens
         │
         ▼
tokenGate.ts checks balance on-chain
         │
         ├── < 100 → BASE tier
         ├── 100-499 → PREMIUM tier
         └── ≥ 500 → EXECUTION tier
                │
                ▼
       loopIntervalMinutes set
       canExecute flag set
       Session created with these params
```

---

## Economic Design

### Token Demand Drivers
1. **Utility demand**: Users who want faster signals and execution capability must hold DeAura
2. **Staking**: Future v2 — stake DeAura for reduced AI inference fees
3. **Governance**: Long-term — DeAura holders vote on new signal types, supported DEXes, and fee structures
4. **Protocol fees**: A % of executed swap volume is taken as protocol fee, distributed to stakers

### Retention Loop
```
Better signals → More profitable decisions
→ Users want more frequent monitoring
→ Acquire DeAura for PREMIUM/EXECUTION
→ More DeAura demand
→ Token appreciation
→ More developers build on ChainPulse AI
→ More signal types → Better signals (loop)
```

### Anti-Dilution Mechanisms
- Token gating creates natural buy pressure as the user base grows
- Staking locks supply (reduces circulating supply)
- Protocol fees create buy-and-distribute pressure
- No inflationary mechanics in base design

---

## Implementation in Code

The token gate is implemented in `apps/api/src/agent/tokenGate.ts`:

```typescript
// Mock mode (MVP): TOKEN_GATE_MOCK=true
// Production: Fetches real on-chain DeAura balance

export async function getTokenGate(walletAddress: string): Promise<TokenGateResult> {
  // In mock mode, all users get BASE tier
  // In production: checks SPL token balance for DEAURA_MINT_ADDRESS
  // Returns: { tier, loopIntervalMinutes, canExecute, deauraBalance }
}
```

To activate real token gating:
1. Launch DeAura token on Solana
2. Set `DEAURA_MINT_ADDRESS` to the real mint
3. Set `TOKEN_GATE_MOCK=false`
4. The system automatically tiers users based on on-chain balance

---

## Launch Plan

See [PITCH.md](PITCH.md) for full launch strategy.

### Phase 1 — Hackathon MVP (Now)
- Token gate in mock mode
- Document utility design
- Build user base with free tier

### Phase 2 — Token Launch (Post-hackathon)
- Deploy DeAura SPL token on Solana mainnet
- Create Raydium / Orca liquidity pool
- Announce via official Buildifi channels
- Activate real token gate (flip `TOKEN_GATE_MOCK=false`)

### Phase 3 — Staking + Governance (v2)
- Deploy staking program (Anchor)
- Implement on-chain governance
- Protocol fee distribution to stakers

---

## Important Note on Volume Requirements

The $200k trading volume requirement for hackathon eligibility:
- This must be achieved through **genuine organic trading volume**
- Community building, social media outreach, and real utility drive organic volume
- **Wash trading is strictly prohibited** and violates Buildifi, DEX ToS, and potentially securities regulations
- Recommended approach: list on Raydium, announce to Solana DeFi communities, let utility drive adoption
- See [PITCH.md](PITCH.md) for community growth tactics
