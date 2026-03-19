// apps/api/src/insights/router.ts
import { Router, Response } from "express";
import { prisma } from "../db/client";
import { AuthenticatedRequest } from "../middleware/auth";

export const insightsRouter = Router();

// ─── GET /insights?sessId=&limit=&type= ──────────────────────────────────────

insightsRouter.get("/", async (req: AuthenticatedRequest, res: Response) => {
  const { sessId, limit = "20", type } = req.query;

  // Verify session ownership if sessId provided
  if (sessId) {
    const session = await prisma.agentSession.findFirst({
      where: { id: String(sessId), userId: req.user!.userId },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });
  }

  const insights = await prisma.insight.findMany({
    where: {
      session: { userId: req.user!.userId },
      ...(sessId ? { sessionId: String(sessId) } : {}),
      ...(type ? { type: String(type) } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Number(limit), 100),
  });

  return res.json(
    insights.map((i) => ({
      ...i,
      evidence: safeJsonParse(i.evidence, []),
    }))
  );
});

function safeJsonParse(val: string | null, fallback: any) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
