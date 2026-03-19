// apps/worker/src/index.ts
// Standalone worker - polls API to trigger due sessions
// Does NOT import Prisma directly - calls API over HTTP

import "dotenv/config";
import cron from "node-cron";
import fetch from "node-fetch";

const API_BASE = process.env.API_BASE_URL || "http://localhost:4000";
const WORKER_SECRET = process.env.WORKER_SECRET || "dev-worker-secret";

async function tick() {
  try {
    // Get due sessions from API
    const resp = await fetch(`${API_BASE}/agent/due-sessions`, {
      headers: { "x-worker-secret": WORKER_SECRET },
    });
    if (!resp.ok) {
      console.error(`[Worker] due-sessions failed: ${resp.status}`);
      return;
    }
    const { sessions } = await resp.json() as { sessions: { id: string }[] };
    if (!sessions?.length) return;

    console.log(`[Worker] ${sessions.length} session(s) due`);

    for (const session of sessions) {
      try {
        const r = await fetch(`${API_BASE}/internal/run-session?sessId=${session.id}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-worker-secret": WORKER_SECRET,
          },
        });
        if (r.ok) {
          console.log(`[Worker] Triggered session ${session.id}`);
        } else {
          console.error(`[Worker] Session ${session.id} failed: ${r.status}`);
        }
      } catch (err: any) {
        console.error(`[Worker] Error triggering ${session.id}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error("[Worker] Tick error:", err.message);
  }
}

cron.schedule("* * * * *", () => {
  const now = new Date().toISOString();
  console.log(`[Worker] Tick at ${now}`);
  tick();
});

console.log(`[ChainPulse Worker] Started — polling ${API_BASE} every minute`);

process.on("SIGTERM", () => { console.log("[Worker] Shutting down"); process.exit(0); });
process.on("SIGINT", () => process.exit(0));
