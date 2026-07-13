import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, workspacesTable, type User } from "@workspace/db";
import { userFromRequest } from "../lib/auth";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by requireAuth; absent on public routes. */
      user?: User;
      /** The authenticated user's personal workspace id (set by requireAuth). */
      workspaceId?: number;
    }
  }
}

/**
 * Rejects unauthenticated requests with 401 and attaches `req.user` otherwise.
 * Mounted in front of every data route; only /healthz and /auth/* stay public.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await userFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    req.user = user;
    const [ws] = await db
      .select({ id: workspacesTable.id })
      .from(workspacesTable)
      .where(eq(workspacesTable.ownerId, user.id))
      .limit(1);
    req.workspaceId = ws?.id;
    next();
  } catch (err) {
    req.log.error({ err }, "Auth lookup failed");
    res.status(500).json({ error: "Authentication check failed" });
  }
}
