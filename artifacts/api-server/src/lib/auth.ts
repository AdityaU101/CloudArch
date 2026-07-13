import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import type { Request, Response } from "express";
import { eq, lt } from "drizzle-orm";
import { db, sessionsTable, usersTable, type User } from "@workspace/db";

const scryptAsync = promisify(scrypt);

export const SESSION_COOKIE = "cloudarch_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// --- password hashing (scrypt, no external deps) -----------------------------

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, keyHex] = stored.split(":");
  if (!salt || !keyHex) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const key = Buffer.from(keyHex, "hex");
  return key.length === derived.length && timingSafeEqual(key, derived);
}

// --- sessions -----------------------------------------------------------------

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(res: Response, userId: number): Promise<void> {
  const token = randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({
    id: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

export async function destroySession(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === "string" && token) {
    await db.delete(sessionsTable).where(eq(sessionsTable.id, hashToken(token)));
  }
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

/** Resolve the session cookie to a user, or null. Expired sessions are pruned lazily. */
export async function userFromRequest(req: Request): Promise<User | null> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== "string" || !token) return null;

  const [row] = await db
    .select({ session: sessionsTable, user: usersTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(eq(sessionsTable.id, hashToken(token)));

  if (!row) return null;
  if (row.session.expiresAt.getTime() < Date.now()) {
    // Opportunistically clear this and any other expired sessions.
    await db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, new Date()));
    return null;
  }
  return row.user;
}
