import { api } from "./api";
import type { Player } from "./types";

export const captainApi = {
  login: (code: string) => api.post<{ team: number }>("/api/captain/login", { code }),
  logout: () => api.post<{ ok: true }>("/api/captain/logout"),
  squad: () => api.get<{ team: { id: number; team_name: string; captain_name: string }; capacity: number; players: Player[] }>("/api/captain/squad"),
};
