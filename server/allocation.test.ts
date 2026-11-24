import { describe, expect, it } from "vitest";
import { POSITIONS, chooseTeam, emptySquads, teamCapacity, type Position, type Squads } from "./allocation";
import { planRebalance, type Move, type Placed } from "./rebalance";

const rng = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const repeat = (p: Position, n: number) => Array<Position>(n).fill(p);

function register(order: Position[], total: number) {
  const sq = emptySquads(); const placed: Placed[] = []; let waiting = 0;
  order.forEach((position, i) => {
    const team = chooseTeam(sq, position, total);
    if (!team) { waiting++; return; }
    sq[team].size++; sq[team].byPosition[position]++;
    placed.push({ id: `p${i}`, team, position, createdAt: String(i).padStart(6, "0") });
  });
  return { sq, placed, waiting };
}
const squadsOf = (players: Placed[]): Squads => {
  const s = emptySquads();
  for (const p of players) { s[p.team].size++; s[p.team].byPosition[p.position]++; }
  return s;
};
const apply = (players: Placed[], moves: Move[]) => {
  const byId = new Map(players.map((p) => [p.id, { ...p }]));
  for (const m of moves) byId.get(m.id)!.team = m.to;
  return [...byId.values()];
};
const expectBalanced = (sq: Squads) => {
  expect(Math.abs(sq[1].size - sq[2].size)).toBeLessThanOrEqual(1);
  for (const p of POSITIONS) expect(Math.abs(sq[1].byPosition[p] - sq[2].byPosition[p])).toBeLessThanOrEqual(1);
};

describe("allocation", () => {
  it("splits 24 players 12/12 and 2/3/4/3 even in adversarial block order", () => {
    const order = [...repeat("forward", 6), ...repeat("midfielder", 8), ...repeat("defender", 6), ...repeat("goalkeeper", 4)];
    const { sq } = register(order, 24);
    expect([sq[1].size, sq[2].size]).toEqual([12, 12]);
    for (const t of [1, 2] as const) expect(sq[t].byPosition).toEqual({ goalkeeper: 2, defender: 3, midfielder: 4, forward: 3 });
  });
  it("gives 5 forwards a 3/2 split", () => {
    const { sq } = register(repeat("forward", 5), 24);
    expect([sq[1].byPosition.forward, sq[2].byPosition.forward].sort()).toEqual([2, 3]);
    expect(Math.abs(sq[1].size - sq[2].size)).toBe(1);
  });
  it("keeps team sizes within 1 and respects capacity for random orders and capacities", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r = rng(seed); const total = [24, 30, 40, 48][seed % 4];
      const n = Math.floor(r() * (total + 8)) + 1;
      const { sq, waiting } = register(Array.from({ length: n }, () => POSITIONS[Math.floor(r() * 4)]), total);
      expect(Math.abs(sq[1].size - sq[2].size)).toBeLessThanOrEqual(1);
      expect(sq[1].size).toBeLessThanOrEqual(teamCapacity(total));
      expect(sq[2].size).toBeLessThanOrEqual(teamCapacity(total));
      expect(waiting).toBe(Math.max(0, n - total));
    }
  });
  it("returns null when full, and uses the other team when one is full", () => {
    const sq = emptySquads(); sq[1].size = 12; sq[2].size = 12;
    expect(chooseTeam(sq, "forward", 24)).toBeNull();
    sq[2].size = 5;
    expect(chooseTeam(sq, "forward", 24)).toBe(2);
    expect(chooseTeam(sq, "forward", 30)).toBe(2);
  });
  it("accepts more players after capacity increases", () => {
    const { sq } = register(repeat("defender", 24), 24);
    expect(chooseTeam(sq, "defender", 24)).toBeNull();
    expect(chooseTeam(sq, "defender", 30)).not.toBeNull();
  });
});

describe("rebalance", () => {
  it("does nothing to an already balanced squad", () => {
    const { placed } = register([...repeat("forward", 4), ...repeat("midfielder", 4), ...repeat("defender", 2)], 24);
    expect(planRebalance(placed, 24)).toEqual([]);
  });
  it("balances a squad that is entirely on one team", () => {
    const pos: Position[] = ["forward", "midfielder", "defender", "forward", "midfielder", "defender", "goalkeeper", "forward", "midfielder", "defender"];
    const placed: Placed[] = pos.map((position, i) => ({ id: `p${i}`, team: 1, position, createdAt: String(i).padStart(6, "0") }));
    const moves = planRebalance(placed, 24);
    expectBalanced(squadsOf(apply(placed, moves)));
    expect(moves.length).toBeLessThanOrEqual(placed.length);
  });
  it("restores full balance after random removals", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const r = rng(seed);
      const { placed } = register(Array.from({ length: 16 + Math.floor(r() * 24) }, () => POSITIONS[Math.floor(r() * 4)]), 48);
      const remaining = placed.filter(() => r() > 0.3);
      expectBalanced(squadsOf(apply(remaining, planRebalance(remaining, 48))));
    }
  });
});
