import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, workspacesTable } from "@workspace/db";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { createSession, destroySession, hashPassword, userFromRequest, verifyPassword } from "../lib/auth";
import { logAudit } from "../lib/audit";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function personalWorkspaceId(userId: number): Promise<number | null> {
  const [ws] = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(eq(workspacesTable.ownerId, userId))
    .limit(1);
  return ws?.id ?? null;
}

router.post("/auth/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Name, a valid email, and a password of at least 8 characters are required" });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const name = parsed.data.name.trim();
  if (!EMAIL_RE.test(email) || !name) {
    res.status(400).json({ error: "A valid email address and name are required" });
    return;
  }

  try {
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const [user] = await db.insert(usersTable).values({ email, name, passwordHash }).returning();
    const [workspace] = await db
      .insert(workspacesTable)
      .values({ name: `${name}'s workspace`, ownerId: user.id })
      .returning();

    await createSession(res, user.id);
    req.user = user;
    req.workspaceId = workspace.id;
    logAudit(req, { actionType: "auth.register", entityType: "user", entityId: user.id });

    res.status(201).json({ id: user.id, email: user.email, name: user.name, workspaceId: workspace.id });
  } catch (err) {
    req.log.error({ err }, "Registration failed");
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    const ok = user && (await verifyPassword(parsed.data.password, user.passwordHash));
    if (!ok) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    await createSession(res, user.id);
    const workspaceId = await personalWorkspaceId(user.id);
    req.user = user;
    req.workspaceId = workspaceId ?? undefined;
    logAudit(req, { actionType: "auth.login", entityType: "user", entityId: user.id });

    res.json({ id: user.id, email: user.email, name: user.name, workspaceId });
  } catch (err) {
    req.log.error({ err }, "Login failed");
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/auth/logout", async (req, res) => {
  try {
    await destroySession(req, res);
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Logout failed");
    res.status(500).json({ error: "Logout failed" });
  }
});

router.get("/auth/me", async (req, res) => {
  try {
    const user = await userFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const workspaceId = await personalWorkspaceId(user.id);
    res.json({ id: user.id, email: user.email, name: user.name, workspaceId });
  } catch (err) {
    req.log.error({ err }, "Session lookup failed");
    res.status(500).json({ error: "Session lookup failed" });
  }
});

export default router;
