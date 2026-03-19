// apps/web/src/lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── Typed API helpers ────────────────────────────────────────────────────────

export const api = {
  sessions: {
    list: () => apiFetch("/sessions"),
    get: (id: string) => apiFetch(`/sessions/${id}`),
    create: (data: object) => apiFetch("/sessions", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: object) =>
      apiFetch(`/sessions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    updateGuardrails: (id: string, data: object) =>
      apiFetch(`/sessions/${id}/guardrails`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/sessions/${id}`, { method: "DELETE" }),
  },
  agent: {
    runOnce: (sessId: string) =>
      apiFetch(`/agent/run-once?sessId=${sessId}`, { method: "POST" }),
    start: () => apiFetch("/agent/start", { method: "POST" }),
    stop: () => apiFetch("/agent/stop", { method: "POST" }),
    status: () => apiFetch("/agent/status"),
  },
  insights: {
    list: (sessId?: string, type?: string) =>
      apiFetch(`/insights?${sessId ? `sessId=${sessId}&` : ""}${type ? `type=${type}` : ""}`),
  },
  actions: {
    list: (sessId?: string, status?: string) =>
      apiFetch(`/actions?${sessId ? `sessId=${sessId}&` : ""}${status ? `status=${status}` : ""}`),
    approve: (id: string) => apiFetch(`/actions/${id}/approve`, { method: "POST" }),
    reject: (id: string) => apiFetch(`/actions/${id}/reject`, { method: "POST" }),
    execute: (id: string) => apiFetch(`/actions/${id}/execute`, { method: "POST" }),
  },
};
