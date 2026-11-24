import { POSITIONS, otherTeam, teamCapacity, type Position, type Team } from "./allocation";

export interface Placed { id: string; team: Team; position: Position; createdAt: string }
export interface Move { id: string; from: Team; to: Team }

/** Minimal-movement plan: fix positional gaps of 2+, then team size gaps of 2+. Never overfills a team. */
export function planRebalance(players: Placed[], totalCapacity: number): Move[] {
  const cap = teamCapacity(totalCapacity);
  const cur = players.map((p) => ({ ...p }));
  const moves: Move[] = [];
  const size = (t: Team) => cur.filter((p) => p.team === t).length;
  const cnt = (t: Team, pos: Position) => cur.filter((p) => p.team === t && p.position === pos).length;
  const newest = (list: Placed[]) => [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  for (let i = 0; i < 500; i++) {
    let pick: Placed | undefined;
    for (const pos of POSITIONS) {
      const d = cnt(1, pos) - cnt(2, pos);
      if (Math.abs(d) < 2) continue;
      const from: Team = d > 0 ? 1 : 2;
      if (size(otherTeam(from)) >= cap) continue;
      pick = newest(cur.filter((p) => p.team === from && p.position === pos));
      break;
    }
    if (!pick && Math.abs(size(1) - size(2)) >= 2) {
      const from: Team = size(1) > size(2) ? 1 : 2, to = otherTeam(from);
      const edge = (p: Placed) => cnt(from, p.position) - cnt(to, p.position);
      pick = cur.filter((p) => p.team === from).sort((a, b) => edge(b) - edge(a) || b.createdAt.localeCompare(a.createdAt))[0];
    }
    if (!pick) break;
    const from = pick.team;
    pick.team = otherTeam(from);
    moves.push({ id: pick.id, from, to: pick.team });
  }
  return moves;
}
