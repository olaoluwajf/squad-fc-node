import { api } from "./api";
import type { Player, Position } from "./types";

export interface AdminLog { id: number; action: string; previous_value: unknown; new_value: unknown; created_at: string; admins: { username: string } | null }
export interface WaitingEntry { id: string; full_name: string; position: Position; created_at: string }

export const adminApi = {
  login: (username: string, password: string) => api.post("/api/admin/login", { username, password }),
  logout: () => api.post("/api/admin/logout"),
  me: () => api.get<{ username: string }>("/api/admin/me"),
  overview: () => api.get<{ players: Player[]; waiting: WaitingEntry[]; logs: AdminLog[] }>("/api/admin/overview"),
  setCapacity: (total: number) => api.post("/api/admin/capacity", { total }),
  setRegistration: (open: boolean, waitingList: boolean) => api.post("/api/admin/registration", { open, waiting_list: waitingList }),
  rebalance: () => api.post<{ moved: number }>("/api/admin/rebalance"),
  updateTeam: (id: number, team_name: string, captain_name: string) => api.patch(`/api/admin/teams/${id}`, { team_name, captain_name }),
  setCaptainCode: (id: number, code: string) => api.put(`/api/admin/teams/${id}/code`, { code }),
  updatePlayer: (id: string, full_name: string, position: Position) => api.patch(`/api/admin/players/${id}`, { full_name, position }),
  movePlayer: (id: string, team: number) => api.post(`/api/admin/players/${id}/move`, { team }),
  removePlayer: (id: string) => api.del(`/api/admin/players/${id}`),
  promote: (id: string) => api.post(`/api/admin/waiting/${id}/promote`),
  removeWaiting: (id: string) => api.del(`/api/admin/waiting/${id}`),
};
