import bcrypt from "bcryptjs";
import { pool } from "./client";
import { registerPlayer } from "../services/registration";
import type { Position } from "../allocation";

const need = (key: string, min = 1) => {
  const v = process.env[key];
  if (!v || v.length < min) throw new Error(`Set ${key} in .env${min > 1 ? ` (at least ${min} characters)` : ""}`);
  return v;
};
const codeA = need("CAPTAIN_A_CODE", 8), codeB = need("CAPTAIN_B_CODE", 8);
if (codeA === codeB) throw new Error("Captain codes must differ");

await pool.query("insert into platform_settings (id) values (1) on conflict do nothing");
await pool.query("insert into teams (id, team_name, captain_name) values (1, 'Team A', 'Captain A'), (2, 'Team B', 'Captain B') on conflict do nothing");
for (const [team, code] of [[1, codeA], [2, codeB]] as const) {
  await pool.query(
    "insert into captains (team_id, access_code_hash) values ($1, $2) on conflict (team_id) do update set access_code_hash = excluded.access_code_hash",
    [team, await bcrypt.hash(code, 12)]);
}
await pool.query(
  "insert into admins (username, password_hash) values ($1, $2) on conflict (username) do update set password_hash = excluded.password_hash",
  [need("ADMIN_USERNAME"), await bcrypt.hash(need("ADMIN_PASSWORD", 10), 12)]);

if (process.argv.includes("--demo") && (await pool.query("select 1 from players")).rowCount === 0) {
  const names = ["Chinedu Okafor", "Emeka Eze", "Tunde Bakare", "Ifeanyi Nwosu", "Samuel Adeyemi", "Kelechi Obi", "Daniel Mba", "Chukwuma Ani", "Obinna Ugwu", "Femi Ojo", "Ikenna Okeke", "David Eke", "Uche Nnamdi", "Kingsley Agu", "Paul Onyeka", "Henry Dike", "Victor Asogwa", "Ahmed Bello", "Tobi Alade", "Sunday Ibe"];
  const pos: Position[] = ["goalkeeper", "defender", "defender", "midfielder", "forward", "midfielder", "defender", "forward", "midfielder", "goalkeeper", "defender", "forward", "midfielder", "defender", "forward", "midfielder", "forward", "defender", "midfielder", "forward"];
  for (let i = 0; i < names.length; i++) await registerPlayer(names[i], pos[i]);
  console.log("demo players added");
}
console.log("seed complete");
await pool.end();
