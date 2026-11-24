export const POSITIONS = ["goalkeeper", "defender", "midfielder", "forward"] as const;
export type Position = (typeof POSITIONS)[number];
export const POSITION_LABEL: Record<Position, string> = {
  goalkeeper: "Goalkeeper", defender: "Defender", midfielder: "Midfielder", forward: "Forward/Attacker",
};
export type PositionCounts = Record<Position, number>;

export interface TeamStat {
  id: number; team_name: string; captain_name: string; capacity: number; total: number; positions: PositionCounts;
}
export interface PublicStats {
  total_capacity: number; registration_open: boolean; waiting_list_enabled: boolean;
  registered: number; waiting: number; positions: PositionCounts; teams: TeamStat[];
}
export interface Player { id: string; full_name: string; position: Position; team_id?: number; created_at: string }
