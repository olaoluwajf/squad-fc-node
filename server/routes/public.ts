import { Hono } from "hono";
import { z } from "zod";
import { body, nameSchema, positionSchema, type Env } from "../http";
import { getPublicStats } from "../services/stats";
import { registerPlayer } from "../services/registration";

export const publicRoutes = new Hono<Env>()
  .get("/stats", async (c) => c.json(await getPublicStats()))
  .post("/register", async (c) => {
    const { full_name, position } = await body(c, z.object({ full_name: nameSchema, position: positionSchema }));
    return c.json(await registerPlayer(full_name, position));
  });
