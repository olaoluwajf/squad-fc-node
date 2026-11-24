import type { Context } from "hono";
import { z } from "zod";
import { POSITIONS } from "./allocation";

export type Env = { Variables: { teamId: number; adminId: string; adminUser: string } };

export class HttpError extends Error {
  constructor(public status: 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503, message: string) { super(message); }
}

export const nameSchema = z.string().trim().min(2, "Enter your full name").max(80, "Name is too long");
export const positionSchema = z.enum(POSITIONS, { message: "Choose a position" });

export async function body<T extends z.ZodTypeAny>(c: Context, schema: T): Promise<z.infer<T>> {
  const r = schema.safeParse(await c.req.json().catch(() => null));
  if (!r.success) throw new HttpError(400, r.error.issues[0]?.message ?? "Invalid input");
  return r.data;
}
export function param<T extends z.ZodTypeAny>(c: Context, name: string, schema: T): z.infer<T> {
  const r = schema.safeParse(c.req.param(name));
  if (!r.success) throw new HttpError(400, `Invalid ${name}`);
  return r.data;
}
export const uuid = z.string().uuid();
export const teamId = z.coerce.number().int().min(1).max(2);
