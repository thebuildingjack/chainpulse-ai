// apps/api/src/auth/router.ts
// Sign-in with Solana: nonce challenge → signed message → JWT session

import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import * as nacl from "tweetnacl";
import bs58 from "bs58";
import jwt from "jsonwebtoken";
import { prisma } from "../db/client";
import { NonceRequestSchema, VerifySignatureSchema } from "@chainpulse/shared";

export const authRouter = Router();

const JWT_SECRET = process.env.SESSION_JWT_SECRET!;
const NONCE_TTL_MINUTES = 5;

// ─── POST /auth/nonce ─────────────────────────────────────────────────────────

authRouter.post("/nonce", async (req: Request, res: Response) => {
  const parsed = NonceRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid wallet address", details: parsed.error.flatten() });
  }

  const { walletAddress } = parsed.data;
  const nonce = uuidv4();
  const expiresAt = new Date(Date.now() + NONCE_TTL_MINUTES * 60 * 1000);

  // Upsert user
  await prisma.user.upsert({
    where: { walletAddress },
    update: {},
    create: { walletAddress },
  });

  // Store nonce
  await prisma.authNonce.create({
    data: { walletAddress, nonce, expiresAt },
  });

  const message = buildSignMessage(walletAddress, nonce);
  return res.json({ nonce, message, expiresAt: expiresAt.toISOString() });
});

// ─── POST /auth/verify ────────────────────────────────────────────────────────

authRouter.post("/verify", async (req: Request, res: Response) => {
  const parsed = VerifySignatureSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const { walletAddress, signature, nonce } = parsed.data;

  // Load nonce record
  const nonceRecord = await prisma.authNonce.findUnique({ where: { nonce } });
  if (!nonceRecord) {
    return res.status(401).json({ error: "Nonce not found or already used" });
  }
  if (nonceRecord.walletAddress !== walletAddress) {
    return res.status(401).json({ error: "Nonce/wallet mismatch" });
  }
  if (nonceRecord.used) {
    return res.status(401).json({ error: "Nonce already used" });
  }
  if (new Date() > nonceRecord.expiresAt) {
    return res.status(401).json({ error: "Nonce expired" });
  }

  // Verify signature
  const message = buildSignMessage(walletAddress, nonce);
  const messageBytes = new TextEncoder().encode(message);

  let sigBytes: Uint8Array;
  try {
    sigBytes = bs58.decode(signature);
  } catch {
    return res.status(401).json({ error: "Invalid signature encoding" });
  }

  let publicKeyBytes: Uint8Array;
  try {
    publicKeyBytes = bs58.decode(walletAddress);
  } catch {
    return res.status(401).json({ error: "Invalid wallet address" });
  }

  const isValid = nacl.sign.detached.verify(messageBytes, sigBytes, publicKeyBytes);
  if (!isValid) {
    return res.status(401).json({ error: "Signature verification failed" });
  }

  // Mark nonce as used
  await prisma.authNonce.update({ where: { nonce }, data: { used: true } });

  // Load user
  const user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user) {
    return res.status(500).json({ error: "User not found after verification" });
  }

  // Issue JWT
  const token = jwt.sign(
    { userId: user.id, walletAddress },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.cookie("cp_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.json({
    success: true,
    userId: user.id,
    walletAddress,
    expiresIn: "7d",
  });
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("cp_token");
  res.json({ success: true });
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

authRouter.get("/me", (req: Request, res: Response) => {
  const token = req.cookies?.cp_token || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.json({ authenticated: false });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; walletAddress: string };
    return res.json({ authenticated: true, userId: payload.userId, walletAddress: payload.walletAddress });
  } catch {
    return res.json({ authenticated: false });
  }
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function buildSignMessage(walletAddress: string, nonce: string): string {
  return [
    "Sign in to ChainPulse AI",
    "",
    `Wallet: ${walletAddress}`,
    `Nonce: ${nonce}`,
    "",
    "This signature is only used for authentication and does not authorize any transactions.",
  ].join("\n");
}
