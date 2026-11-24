import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { config } from "./config";
import { HttpError } from "./http";
import { publicRoutes } from "./routes/public";
import { captainRoutes } from "./routes/captain";
import { adminRoutes } from "./routes/admin";

const app = new Hono();
app.use("*", secureHeaders());
app.use("/api/*", csrf());

app.route("/api", publicRoutes);
app.route("/api/captain", captainRoutes);
app.route("/api/admin", adminRoutes);
app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

if (config.prod) { // one deployable: the API also serves the built frontend
  app.use("/*", serveStatic({ root: "./dist" }));
  app.get("*", serveStatic({ path: "./dist/index.html" }));
}

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
  const code = (err as { code?: string }).code;
  if (code === "23505") return c.json({ error: "That name is already registered" }, 409);
  if (code === "23514") return c.json({ error: "A team is full" }, 409);
  if (code && ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "57P01", "08006", "08001"].includes(code)) {
    console.error("Database unavailable:", err.message);
    return c.json({ error: "Database unavailable. Please try again shortly." }, 503);
  }
  console.error(err);
  return c.json({ error: "Something went wrong" }, 500);
});

serve({ fetch: app.fetch, port: config.port }, (i) => console.log(`Squad FC API on http://localhost:${i.port}`));
