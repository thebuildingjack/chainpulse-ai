// apps/api/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from "express";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error("[ChainPulse Error]", err.message);
  const status = (err as any).status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
}
