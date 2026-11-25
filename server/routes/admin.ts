import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db/client";
import { DUMMY_HASH, assertNotLocked, clearFailures, clientIp, endSession, recordFailure, requireAdmin, startSession, verifyHash } from "../auth";
import { HttpError, body, nameSchema, param, positionSchema, teamId, uuid, type Env } from "../http";
import * as admin from "../services/admin";

export const adminRoutes = new Hono<Env>();

adminRoutes.post("/login", async (c) => {
  const { username, password } = await body(c, z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(200) }));
  const ip = clientIp(c);
  await assertNotLocked("admin", ip);
  const row = (await pool.query<{ id: string; password_hash: string }>(
    "select id, password_hash from admins where username = $1", [username])).rows[0];
  const ok = await verifyHash(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) { await recordFailure("admin", ip); throw new HttpError(401, "Invalid credentials"); }
  await clearFailures("admin", ip);
  await startSession(c, "admin", { adminId: row.id });
  return c.json({ ok: true });
});
adminRoutes.post("/logout", (c) => { endSession(c, "admin"); return c.json({ ok: true }); });

adminRoutes.use("*", requireAdmin); // everything below needs a valid admin session

adminRoutes.get("/me", (c) => c.json({ username: c.get("adminUser") }));
adminRoutes.get("/overview", async (c) => c.json(await admin.getOverview()));

adminRoutes.post("/capacity", async (c) => {
  const { total } = await body(c, z.object({ total: z.number().int().min(2).max(500).refine((n) => n % 2 === 0, "Total capacity must be an even number") }));
  await admin.setCapacity(c.get("adminId"), total);
  return c.json({ ok: true });
});
adminRoutes.post("/registration", async (c) => {
  const { open, waiting_list } = await body(c, z.object({ open: z.boolean(), waiting_list: z.boolean() }));
  await admin.setRegistration(c.get("adminId"), open, waiting_list);
  return c.json({ ok: true });
});
adminRoutes.post("/rebalance", async (c) => c.json(await admin.rebalance(c.get("adminId"))));

adminRoutes.patch("/teams/:id", async (c) => {
  const { team_name, captain_name } = await body(c, z.object({ team_name: z.string().trim().min(1).max(40), captain_name: z.string().trim().min(1).max(60) }));
  await admin.updateTeam(c.get("adminId"), param(c, "id", teamId), team_name, captain_name);
  return c.json({ ok: true });
});
adminRoutes.put("/teams/:id/code", async (c) => {
  const { code } = await body(c, z.object({ code: z.string().min(8, "Access code must be at least 8 characters").max(100) }));
  await admin.setCaptainCode(c.get("adminId"), param(c, "id", teamId), code);
  return c.json({ ok: true });
});

adminRoutes.patch("/players/:id", async (c) => {
  const { full_name, position } = await body(c, z.object({ full_name: nameSchema, position: positionSchema }));
  await admin.updatePlayer(c.get("adminId"), param(c, "id", uuid), full_name, position);
  return c.json({ ok: true });
});
adminRoutes.post("/players/:id/move", async (c) => {
  const { team } = await body(c, z.object({ team: z.union([z.literal(1), z.literal(2)]) }));
  await admin.movePlayer(c.get("adminId"), param(c, "id", uuid), team);
  return c.json({ ok: true });
});
adminRoutes.delete("/players/:id", async (c) => {
  await admin.removePlayer(c.get("adminId"), param(c, "id", uuid));
  return c.json({ ok: true });
});

adminRoutes.post("/waiting/:id/promote", async (c) => {
  await admin.promote(c.get("adminId"), param(c, "id", uuid));
  return c.json({ ok: true });
});
adminRoutes.delete("/waiting/:id", async (c) => {
  await admin.removeWaiting(c.get("adminId"), param(c, "id", uuid));
  return c.json({ ok: true });
});
