import { readdirSync, readFileSync } from "node:fs";
import { pool } from "./client";

const dir = new URL("./migrations/", import.meta.url);
await pool.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if ((await pool.query("select 1 from schema_migrations where name = $1", [file])).rowCount) continue;
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(readFileSync(new URL(file, dir), "utf8"));
    await c.query("insert into schema_migrations (name) values ($1)", [file]);
    await c.query("commit");
    console.log("applied", file);
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}
await pool.end();
