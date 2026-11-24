import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { config } from "./config";
import { app } from "./app";

if (config.prod) { // one deployable: the API also serves the built frontend
  app.use("/*", serveStatic({ root: "./dist" }));
  app.get("*", serveStatic({ path: "./dist/index.html" }));
}

serve({ fetch: app.fetch, port: config.port }, (i) => console.log(`Squad FC API on http://localhost:${i.port}`));
