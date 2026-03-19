// apps/api/src/sessions/router.ts
import { Router, Response } from "express";
import { prisma } from "../db/client";
import { AuthenticatedRequest } from "../middleware/auth";
import {
  CreateSessionSchema,
  UpdateSessionSchema,
  UpdateGuardrailsSchema,
} from "@chainpulse/shared";
import { getTokenGate } from "../agent/tokenGate";

export const sessionsRouter = Router();

// ─── POST /sessions ───────────────────────────────────────────────────────────

sessionsRouter.post("/", async (req: AuthenticatedRequest, res: Response) => {
  const parsed = CreateSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  const { walletAddress, userId } = req.user!;
  const data = parsed.data;

  // Check token gate for loop interval
  const gate = await getTokenGate(walletAddress);

  const session = await prisma.agentSession.create({
    data: {
      userId,
      walletAddress,
      watchlistMints: JSON.stringify(data.watchlistMints),
      watchlistPrograms: JSON.stringify(data.watchlistPrograms),
      timeframe: data.timeframe,
      riskLevel: data.riskLevel,
      permissionsMode: data.permissionsMode,
      guardrails: JSON.stringify(data.guardrails),
      loopIntervalMinutes: gate.loopIntervalMinutes,
      nextRunAt: new Date(Date.now() + gate.loopIntervalMinutes * 60 * 1000),
    },
  });

  return res.status(201).json(formatSession(session));
});

// ─── GET /sessions ────────────────────────────────────────────────────────────

sessionsRouter.get("/", async (req: AuthenticatedRequest, res: Response) => {
  const sessions = await prisma.agentSession.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: "desc" },
  });
  return res.json(sessions.map(formatSession));
});

// ─── GET /sessions/:id ────────────────────────────────────────────────────────

sessionsRouter.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
  const session = await prisma.agentSession.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
    include: {
      runs: { orderBy: { startedAt: "desc" }, take: 10 },
    },
  });
  if (!session) return res.status(404).json({ error: "Session not found" });
  return res.json(formatSession(session));
});

// ─── PATCH /sessions/:id ──────────────────────────────────────────────────────

sessionsRouter.patch("/:id", async (req: AuthenticatedRequest, res: Response) => {
  const parsed = UpdateSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  const existing = await prisma.agentSession.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  if (!existing) return res.status(404).json({ error: "Session not found" });

  const data = parsed.data;
  const updated = await prisma.agentSession.update({
    where: { id: req.params.id },
    data: {
      ...(data.watchlistMints && { watchlistMints: JSON.stringify(data.watchlistMints) }),
      ...(data.watchlistPrograms && { watchlistPrograms: JSON.stringify(data.watchlistPrograms) }),
      ...(data.timeframe && { timeframe: data.timeframe }),
      ...(data.riskLevel && { riskLevel: data.riskLevel }),
      ...(data.permissionsMode && { permissionsMode: data.permissionsMode }),
    },
  });

  return res.json(formatSession(updated));
});

// ─── PATCH /sessions/:id/guardrails ───────────────────────────────────────────

sessionsRouter.patch("/:id/guardrails", async (req: AuthenticatedRequest, res: Response) => {
  const parsed = UpdateGuardrailsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  const existing = await prisma.agentSession.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  if (!existing) return res.status(404).json({ error: "Session not found" });

  const currentGuardrails = JSON.parse(existing.guardrails || "{}");
  const mergedGuardrails = { ...currentGuardrails, ...parsed.data };

  const updated = await prisma.agentSession.update({
    where: { id: req.params.id },
    data: { guardrails: JSON.stringify(mergedGuardrails) },
  });

  return res.json(formatSession(updated));
});

// ─── DELETE /sessions/:id ─────────────────────────────────────────────────────

sessionsRouter.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  const existing = await prisma.agentSession.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  if (!existing) return res.status(404).json({ error: "Session not found" });

  await prisma.agentSession.update({
    where: { id: req.params.id },
    data: { isActive: false },
  });

  return res.json({ success: true });
});

// ─── Formatter ────────────────────────────────────────────────────────────────

function formatSession(s: any) {
  return {
    ...s,
    watchlistMints: safeJsonParse(s.watchlistMints, []),
    watchlistPrograms: safeJsonParse(s.watchlistPrograms, []),
    guardrails: safeJsonParse(s.guardrails, {}),
    runs: s.runs?.map((r: any) => ({
      ...r,
      toolCallLog: safeJsonParse(r.toolCallLog, []),
    })),
  };
}

function safeJsonParse(val: string | null | undefined, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
