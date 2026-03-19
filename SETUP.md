# ChainPulse AI — Setup Guide

## Prerequisites
- Node.js 18+
- pnpm 8+ (`npm install -g pnpm`)

## First-time Setup

```bash
# 1. Install all dependencies
pnpm install

# 2. Set your AI API key
# Edit apps/api/.env and set: AI_API_KEY=your_anthropic_key_here

# 3. Initialize database
cd apps/api
npx prisma generate
npx prisma db push
npx ts-node prisma/seed.ts
cd ../..

# 4. Start all services
pnpm dev
```

## Services
- **API**: http://localhost:4000
- **Frontend**: http://localhost:3000
- **Worker**: background cron (auto-starts with API)

## Verify it works
```bash
curl http://localhost:4000/health
# {"status":"ok","ts":"..."}
```

## Common issues

**pnpm not found:**
```bash
npm install -g pnpm
```

**Prisma client not initialized:**
```bash
cd apps/api && npx prisma generate && cd ../..
```

**Port already in use:**
```bash
lsof -ti:4000 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```
