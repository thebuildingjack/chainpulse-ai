import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import { authRouter } from "./auth/router";
import { sessionsRouter } from "./sessions/router";
import { agentRouter } from "./agent/router";
import { insightsRouter } from "./insights/router";
import { actionsRouter } from "./actions/router";
import { errorHandler } from "./middleware/errorHandler";
import { requireAuth } from "./middleware/auth";
import { startScheduler } from "./agent/scheduler";

const app = express();
const PORT = process.env.PORT || 4000;
const WORKER_SECRET = process.env.WORKER_SECRET || "dev-worker-secret";

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: "512kb" }));

const writeLimiter = rateLimit({ windowMs: 60_000, max: 200, message: { error: "Too many requests." } });
const authLimiter  = rateLimit({ windowMs: 60_000, max: 10, message: { error: "Too many auth attempts." } });

// Worker-only middleware — validates x-worker-secret header
function workerAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.headers["x-worker-secret"] === WORKER_SECRET) return next();
  res.status(401).json({ error: "Unauthorized" });
}

// ─── Public routes ────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));
app.use("/auth", authLimiter, authRouter);

// ─── Worker-only routes (no JWT needed) ───────────────────────────────────────
import { prisma } from "./db/client";
import { runAgentLoop } from "./agent/agentLoop";

app.get("/agent/due-sessions", workerAuth, async (_req, res) => {
  const now = new Date();
  const sessions = await prisma.agentSession.findMany({
    where: { isActive: true, OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }] },
    take: 10,
    select: { id: true },
  });
  res.json({ sessions });
});

app.post("/internal/run-session", workerAuth, async (req: express.Request, res: express.Response) => {
  const sessId = String(req.query.sessId || "");
  if (!sessId) return res.status(400).json({ error: "sessId required" });
  const session = await prisma.agentSession.findUnique({ where: { id: sessId } });
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json({ message: "Run started", sessionId: sessId });
  runAgentLoop(sessId).catch(err => console.error("[API] Loop error:", err.message));
});

// ─── Authenticated routes ─────────────────────────────────────────────────────
app.use("/sessions",   requireAuth, writeLimiter, sessionsRouter);
app.use("/agent",      requireAuth, writeLimiter, agentRouter);
app.use("/insights",   requireAuth, insightsRouter);
app.use("/actions",    requireAuth, writeLimiter, actionsRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[ChainPulse API] Listening on port ${PORT}`);
  // Auto-start scheduler in API process
  startScheduler();
});

export default app;
