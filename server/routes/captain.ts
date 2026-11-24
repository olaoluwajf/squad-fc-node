import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db/client";
import { teamCapacity } from "../allocation";
import { assertNotLocked, clearFailures, clientIp, endSession, recordFailure, requireCaptain, startSession, verifyHash } from "../auth";
import { HttpError, body, type Env } from "../http";

export const captainRoutes = new Hono<Env>();

captainRoutes.post("/login", async (c) => {
  const { code } = await body(c, z.object({ code: z.string().min(1).max(200) }));
  const ip = clientIp(c);
  await assertNotLocked("captain", ip);
  const { rows } = await pool.query("select team_id, access_code_hash from captains");
  for (const r of rows) {
    if (await verifyHash(code, r.access_code_hash)) {
      await clearFailures("captain", ip);
      await startSession(c, "captain", { team: r.team_id });
      return c.json({ team: r.team_id });
    }
  }
  await recordFailure("captain", ip);
  throw new HttpError(401, "Invalid access code");
});

captainRoutes.post("/logout", (c) => { endSession(c, "captain"); return c.json({ ok: true }); });

captainRoutes.get("/squad", requireCaptain, async (c) => {
  const team = c.get("teamId");
  const [t, s, p] = await Promise.all([
    pool.query("select id, team_name, captain_name from teams where id = $1", [team]),
    pool.query("select total_capacity from platform_settings where id = 1"),
    pool.query("select id, full_name, position, created_at from players where team_id = $1 order by created_at, id", [team]),
  ]);
  return c.json({ team: t.rows[0], capacity: teamCapacity(s.rows[0].total_capacity), players: p.rows });
});
