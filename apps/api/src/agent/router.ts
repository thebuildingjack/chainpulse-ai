// apps/api/src/agent/router.ts
// Authenticated agent endpoints (user-facing, JWT required)
import { Router, Response } from "express";
import { prisma } from "../db/client";
import { runAgentLoop } from "./agentLoop";
import { startScheduler, stopScheduler } from "./scheduler";
import { AuthenticatedRequest } from "../middleware/auth";
import { z } from "zod";

export const agentRouter = Router();

// POST /agent/run-once?sessId= — user triggers their own session
agentRouter.post("/run-once", async (req: AuthenticatedRequest, res: Response) => {
  const sessId = z.string().safeParse(req.query.sessId);
  if (!sessId.success) return res.status(400).json({ error: "sessId query param required" });

  const session = await prisma.agentSession.findFirst({
    where: { id: sessId.data, userId: req.user!.userId },
  });
  if (!session) return res.status(404).json({ error: "Session not found" });

  res.json({ message: "Agent run started", sessionId: sessId.data });
  runAgentLoop(sessId.data).catch(err => console.error("[Agent]", err.message));
});

agentRouter.post("/start",  (_req, res) => { startScheduler(); res.json({ message: "Scheduler started" }); });
agentRouter.post("/stop",   (_req, res) => { stopScheduler();  res.json({ message: "Scheduler stopped" }); });

agentRouter.get("/status", async (req: AuthenticatedRequest, res: Response) => {
  const sessions = await prisma.agentSession.findMany({
    where: { userId: req.user!.userId, isActive: true },
    select: { id: true, lastRunAt: true, nextRunAt: true, loopIntervalMinutes: true, permissionsMode: true },
  });
  res.json({ sessions, schedulerActive: true });
});
