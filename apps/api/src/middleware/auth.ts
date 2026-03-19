import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_JWT_SECRET!;
const WORKER_SECRET = process.env.WORKER_SECRET || "dev-worker-secret";

export interface AuthenticatedRequest extends Request {
  user?: { userId: string; walletAddress: string };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Allow internal worker calls through
  if (req.headers["x-worker-secret"] === WORKER_SECRET) {
    req.user = { userId: "worker", walletAddress: "worker" };
    return next();
  }

  const token = req.cookies?.cp_token || req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; walletAddress: string };
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}
