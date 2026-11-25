import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { pool, tx, type Db } from "../db/client";
import { HttpError } from "../http";
import { chooseTeam, teamCapacity, type Position, type Team } from "../allocation";
import { planRebalance } from "../rebalance";
import { loadSquads } from "./stats";
import { normalizeName } from "./registration";

const log = (c: Db, adminId: string, action: string, playerId: string | null, prev: unknown, next: unknown) =>
  c.query(
    "insert into activity_logs (admin_id, action, affected_player_id, previous_value, new_value) values ($1, $2, $3, $4, $5)",
    [adminId, action, playerId, prev == null ? null : JSON.stringify(prev), next == null ? null : JSON.stringify(next)]);
interface SettingsRow {
  total_capacity: number;
  registration_open: number;
  waiting_list_enabled: number;
}

interface PlayerRow {
  id: string;
  full_name: string;
  position: Position;
  team_id: Team;
  created_at: string;
}

const lockSettings = async (c: Db) => (await c.query<SettingsRow>("select * from platform_settings where id = 1")).rows[0];

export async function getOverview() {
  const [players, waiting, logs] = await Promise.all([
    pool.query<PlayerRow>("select id, full_name, position, team_id, created_at from players order by created_at, id"),
    pool.query<{ id: string; full_name: string; position: Position; created_at: string }>(
      "select id, full_name, position, created_at from waiting_list where status = 'waiting' order by created_at"),
    pool.query<{ id: number; action: string; previous_value: string | null; new_value: string | null; created_at: string; username: string | null }>(`select l.id, l.action, l.previous_value, l.new_value, l.created_at, a.username
                from activity_logs l left join admins a on a.id = l.admin_id order by l.created_at desc, l.id desc limit 50`),
  ]);
  return {
    players: players.rows, waiting: waiting.rows,
    logs: logs.rows.map(({ username, previous_value, new_value, ...l }) => ({
      ...l,
      previous_value: previous_value === null ? null : JSON.parse(previous_value),
      new_value: new_value === null ? null : JSON.parse(new_value),
      admins: username ? { username } : null,
    })),
  };
}

export const removePlayer = (adminId: string, id: string) => tx(async (c) => {
  const r = await c.query("delete from players where id = $1 returning *", [id]);
  if (!r.rowCount) throw new HttpError(404, "Player not found");
  await log(c, adminId, "player_removed", id, r.rows[0], null);
});

export const updatePlayer = (adminId: string, id: string, name: string, position: Position) => tx(async (c) => {
  const old = (await c.query<PlayerRow>("select * from players where id = $1", [id])).rows[0];
  if (!old) throw new HttpError(404, "Player not found");
  const clean = normalizeName(name);
  await c.query("update players set full_name = $2, position = $3, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = $1", [id, clean, position]);
  await log(c, adminId, old.position !== position ? "player_position_changed" : "player_edited", id,
    { name: old.full_name, position: old.position }, { name: clean, position });
});

export const movePlayer = (adminId: string, id: string, team: Team) => tx(async (c) => {
  const s = await lockSettings(c);
  const old = (await c.query<PlayerRow>("select * from players where id = $1", [id])).rows[0];
  if (!old) throw new HttpError(404, "Player not found");
  if (old.team_id === team) return;
  if ((await loadSquads(c))[team].size >= teamCapacity(s.total_capacity)) throw new HttpError(409, "Target team is full");
  await c.query("update players set team_id = $2, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = $1", [id, team]);
  await log(c, adminId, "player_moved", id, { team: old.team_id }, { team });
});

export const setCapacity = (adminId: string, total: number) => tx(async (c) => {
  const s = await lockSettings(c);
  const squads = await loadSquads(c);
  if (Math.max(squads[1].size, squads[2].size) > teamCapacity(total))
    throw new HttpError(409, "A team has more players than the new per-team capacity. Remove players or rebalance first");
  await c.query("update platform_settings set total_capacity = $1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = 1", [total]);
  await log(c, adminId, "capacity_changed", null, s.total_capacity, total);
});

export const setRegistration = (adminId: string, open: boolean, waitingList: boolean) => tx(async (c) => {
  const s = await lockSettings(c);
  await c.query("update platform_settings set registration_open = $1, waiting_list_enabled = $2, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = 1", [open, waitingList]);
  await log(c, adminId, "registration_changed", null,
    { open: Boolean(s.registration_open), waiting_list: Boolean(s.waiting_list_enabled) }, { open, waiting_list: waitingList });
});

export const updateTeam = (adminId: string, id: number, teamName: string, captainName: string) => tx(async (c) => {
  const old = (await c.query<{ team_name: string; captain_name: string }>("select * from teams where id = $1", [id])).rows[0];
  if (!old) throw new HttpError(404, "Team not found");
  await c.query("update teams set team_name = $2, captain_name = $3, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = $1", [id, teamName, captainName]);
  await log(c, adminId, "team_updated", null, { team: old.team_name, captain: old.captain_name }, { team: teamName, captain: captainName });
});

export async function setCaptainCode(adminId: string, id: number, code: string) {
  const hash = await bcrypt.hash(code, 12);
  return tx(async (c) => {
    const r = await c.query("update captains set access_code_hash = $2 where team_id = $1", [id, hash]);
    if (!r.rowCount) throw new HttpError(404, "Captain not found");
    await log(c, adminId, "captain_code_changed", null, null, { team: id }); // the code itself is never logged
  });
}

export const promote = (adminId: string, waitingId: string) => tx(async (c) => {
  const s = await lockSettings(c);
  const w = (await c.query<{ full_name: string; position: Position }>(
    "select * from waiting_list where id = $1 and status = 'waiting'", [waitingId])).rows[0];
  if (!w) throw new HttpError(404, "Not on the waiting list");
  const team = chooseTeam(await loadSquads(c), w.position, s.total_capacity);
  if (team === null) throw new HttpError(409, "No free slots");
  await c.query("insert into players (id, full_name, position, team_id) values ($1, $2, $3, $4)",
    [randomUUID(), w.full_name, w.position, team]);
  await c.query("update waiting_list set status = 'promoted' where id = $1", [waitingId]);
  await log(c, adminId, "waiting_list_promoted", null, null, { name: w.full_name, team });
});

export const removeWaiting = (adminId: string, waitingId: string) => tx(async (c) => {
  const r = await c.query("update waiting_list set status = 'removed' where id = $1 and status = 'waiting' returning full_name", [waitingId]);
  if (!r.rowCount) throw new HttpError(404, "Not on the waiting list");
  await log(c, adminId, "waiting_list_removed", null, { name: r.rows[0].full_name }, null);
});

export const rebalance = (adminId: string) => tx(async (c) => {
  const s = await lockSettings(c);
  const { rows } = await c.query<PlayerRow>("select id, team_id, position, created_at from players");
  const moves = planRebalance(rows.map((p) => ({ id: p.id, team: p.team_id, position: p.position, createdAt: p.created_at })), s.total_capacity);
  for (const m of moves) {
    await c.query("update players set team_id = $2, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = $1", [m.id, m.to]);
    await log(c, adminId, "rebalance_move", m.id, { team: m.from }, { team: m.to });
  }
  await log(c, adminId, "auto_rebalance", null, null, { moved: moves.length });
  return { moved: moves.length };
});
