import { readdirSync, readFileSync } from "node:fs";
import { closeDatabase, pool, tx } from "./client";

const dir = new URL("./migrations/", import.meta.url);
await pool.query("create table if not exists schema_migrations (name text primary key, applied_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))");
try {
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if ((await pool.query("select 1 from schema_migrations where name = $1", [file])).rowCount) continue;
    await tx(async (c) => {
      await c.executeMultiple(readFileSync(new URL(file, dir), "utf8"));
      await c.query("insert into schema_migrations (name) values ($1)", [file]);
    });
    console.log("applied", file);
  }
} finally {
  closeDatabase();
}
