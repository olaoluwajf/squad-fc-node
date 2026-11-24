import { POSITIONS, type Position } from "../src/lib/types";
export { POSITIONS };
export type { Position };

export type Team = 1 | 2;
export interface Squad { size: number; byPosition: Record<Position, number> }
export type Squads = Record<Team, Squad>;

const W_SIZE = 10; // equal team sizes matter most
const W_POS = 4;   // then equal positional spread

export const teamCapacity = (totalCapacity: number) => Math.floor(totalCapacity / 2);
export const otherTeam = (t: Team): Team => (t === 1 ? 2 : 1);

const blank = (): Squad => ({ size: 0, byPosition: { goalkeeper: 0, defender: 0, midfielder: 0, forward: 0 } });
export const emptySquads = (): Squads => ({ 1: blank(), 2: blank() });

/** Picks the team that gives the best balance after adding one player, or null when both teams are full. */
export function chooseTeam(squads: Squads, position: Position, totalCapacity: number): Team | null {
  const cap = teamCapacity(totalCapacity);
  const a = squads[1], b = squads[2];
  if (a.size >= cap && b.size >= cap) return null;
  if (a.size >= cap) return 2;
  if (b.size >= cap) return 1;
  const scoreA = W_SIZE * Math.abs(a.size + 1 - b.size) + W_POS * Math.abs(a.byPosition[position] + 1 - b.byPosition[position]);
  const scoreB = W_SIZE * Math.abs(b.size + 1 - a.size) + W_POS * Math.abs(b.byPosition[position] + 1 - a.byPosition[position]);
  if (scoreA !== scoreB) return scoreA < scoreB ? 1 : 2;
  if (a.size !== b.size) return a.size < b.size ? 1 : 2;
  return a.size % 2 === 0 ? 1 : 2; // alternate the extra player on a full tie
}
