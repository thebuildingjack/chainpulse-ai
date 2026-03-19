// apps/api/src/agent/scheduler.ts
// Scheduler: polls active sessions every minute, runs loops for due sessions.

import cron from "node-cron";
import { prisma } from "../db/client";
import { runAgentLoop } from "./agentLoop";

let isRunning = false;
let schedulerJob: cron.ScheduledTask | null = null;

export function startScheduler() {
  if (schedulerJob) {
    console.log("[Scheduler] Already running");
    return;
  }

  // Poll every minute, check which sessions are due
  schedulerJob = cron.schedule("* * * * *", async () => {
    if (isRunning) return; // Prevent overlapping runs
    isRunning = true;

    try {
      const now = new Date();
      const dueSessions = await prisma.agentSession.findMany({
        where: {
          isActive: true,
          OR: [
            { nextRunAt: null },
            { nextRunAt: { lte: now } },
          ],
        },
        take: 10, // Process at most 10 sessions per tick
      });

      if (dueSessions.length > 0) {
        console.log(`[Scheduler] Running ${dueSessions.length} due session(s)`);
      }

      for (const session of dueSessions) {
        // Run concurrently but cap at 5 parallel
        runAgentLoop(session.id).catch((err) => {
          console.error(`[Scheduler] Loop error for session ${session.id}:`, err.message);
        });
      }
    } catch (err: any) {
      console.error("[Scheduler] Tick error:", err.message);
    } finally {
      isRunning = false;
    }
  });

  console.log("[Scheduler] Started — polling every minute for due sessions");
}

export function stopScheduler() {
  if (schedulerJob) {
    schedulerJob.stop();
    schedulerJob = null;
    console.log("[Scheduler] Stopped");
  }
}
