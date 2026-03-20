import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_JWT_SECRET!;

export interface AuthenticatedRequest extends Request {
  user?: { userId: string; walletAddress: string };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; walletAddress: string };
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}