import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context, MiddlewareHandler } from "hono";
import { config } from "./config";
import { pool } from "./db/client";
import { HttpError, type Env } from "./http";

type Kind = "captain" | "admin";
const MAX_FAILURES = 5;

export const clientIp = (c: Context) =>
  (config.trustProxy ? c.req.header("x-forwarded-for")?.split(",")[0].trim() : undefined) ?? getConnInfo(c).remote.address ?? "unknown";

// ---- login rate limiting (failed attempts per IP and scope, 15 minute window) ----
export async function assertNotLocked(scope: Kind, ip: string) {
  const { rows } = await pool.query(
    "select count(*)::int as n from login_attempts where scope = $1 and ip = $2 and created_at > now() - interval '15 minutes'", [scope, ip]);
  if (rows[0].n >= MAX_FAILURES) throw new HttpError(429, "Too many failed attempts. Try again in 15 minutes.");
}
export const recordFailure = (scope: Kind, ip: string) => pool.query("insert into login_attempts (scope, ip) values ($1, $2)", [scope, ip]);
export const clearFailures = (scope: Kind, ip: string) => pool.query("delete from login_attempts where scope = $1 and ip = $2", [scope, ip]);

export const verifyHash = (plain: string, hash: string) => bcrypt.compare(plain, hash);
export const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12); // equalises timing for unknown usernames

// ---- sessions: signed JWT in an HTTP-only, same-site cookie ----
export async function startSession(c: Context, kind: Kind, claims: Record<string, string | number>) {
  const token = await new SignJWT({ ...claims, kind }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("8h").sign(config.sessionSecret);
  setCookie(c, `${kind}_session`, token, { httpOnly: true, secure: config.prod, sameSite: "Lax", path: "/", maxAge: 8 * 3600 });
}
export const endSession = (c: Context, kind: Kind) => deleteCookie(c, `${kind}_session`, { path: "/" });

async function readSession(c: Context, kind: Kind) {
  const token = getCookie(c, `${kind}_session`);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, config.sessionSecret);
    return payload.kind === kind ? payload : null;
  } catch { return null; }
}

export const requireCaptain: MiddlewareHandler<Env> = async (c, next) => {
  const s = await readSession(c, "captain");
  if (!s) throw new HttpError(401, "Unauthorized");
  c.set("teamId", s.team as number); // the team comes from the signed session only, never from the request
  await next();
};
export const requireAdmin: MiddlewareHandler<Env> = async (c, next) => {
  const s = await readSession(c, "admin");
  if (!s) throw new HttpError(401, "Unauthorized");
  const { rows } = await pool.query("select id, username from admins where id = $1", [s.adminId]);
  if (!rows[0]) throw new HttpError(401, "Unauthorized"); // admin removed since login
  c.set("adminId", rows[0].id); c.set("adminUser", rows[0].username);
  await next();
};
