import { pool, type Db } from "../db/client";
import { POSITIONS, emptySquads, teamCapacity, type Position, type Squads, type Team } from "../allocation";
import type { PositionCounts, PublicStats } from "../../src/lib/types";

export async function loadSquads(c: Db = pool): Promise<Squads> {
  const squads = emptySquads();
  const { rows } = await c.query("select team_id, position, count(*)::int as n from players group by team_id, position");
  for (const r of rows) {
    squads[r.team_id as Team].size += r.n;
    squads[r.team_id as Team].byPosition[r.position as Position] = r.n;
  }
  return squads;
}

export async function getPublicStats(): Promise<PublicStats> {
  const [settings, teams, squads, waiting] = await Promise.all([
    pool.query("select * from platform_settings where id = 1"),
    pool.query("select id, team_name, captain_name from teams order by id"),
    loadSquads(),
    pool.query("select count(*)::int as n from waiting_list where status = 'waiting'"),
  ]);
  const s = settings.rows[0];
  const positions = Object.fromEntries(POSITIONS.map((p) => [p, squads[1].byPosition[p] + squads[2].byPosition[p]])) as PositionCounts;
  return {
    total_capacity: s.total_capacity,
    registration_open: s.registration_open,
    waiting_list_enabled: s.waiting_list_enabled,
    registered: squads[1].size + squads[2].size, // derived from one query, so it always matches the team counts
    waiting: waiting.rows[0].n,
    positions,
    teams: teams.rows.map((t) => ({
      ...t, capacity: teamCapacity(s.total_capacity), total: squads[t.id as Team].size, positions: squads[t.id as Team].byPosition,
    })),
  };
}
