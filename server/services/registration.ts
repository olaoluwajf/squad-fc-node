import { tx } from "../db/client";
import { chooseTeam, type Position } from "../allocation";
import { loadSquads } from "./stats";

export type RegisterResult =
  | { status: "registered"; full_name: string; position: Position; team_name: string; captain_name: string }
  | { status: "waitlisted" | "duplicate" | "closed" | "full" };

export const normalizeName = (s: string) => s.trim().replace(/\s+/g, " ");

export function registerPlayer(rawName: string, position: Position): Promise<RegisterResult> {
  const name = normalizeName(rawName);
  return tx<RegisterResult>(async (c) => {
    // Row lock on settings serialises concurrent registrations, so counts are never stale.
    const s = (await c.query("select * from platform_settings where id = 1 for update")).rows[0];
    const dup = await c.query(
      `select 1 from players where lower(trim(full_name)) = lower($1)
       union all select 1 from waiting_list where status = 'waiting' and lower(trim(full_name)) = lower($1)`, [name]);
    if (dup.rowCount) return { status: "duplicate" };
    if (!s.registration_open) return { status: "closed" };

    const team = chooseTeam(await loadSquads(c), position, s.total_capacity);
    if (team === null) {
      if (!s.waiting_list_enabled) return { status: "full" };
      await c.query("insert into waiting_list (full_name, position) values ($1, $2)", [name, position]);
      return { status: "waitlisted" };
    }
    await c.query("insert into players (full_name, position, team_id) values ($1, $2, $3)", [name, position, team]);
    const t = (await c.query("select team_name, captain_name from teams where id = $1", [team])).rows[0];
    return { status: "registered", full_name: name, position, team_name: t.team_name, captain_name: t.captain_name };
  });
}
