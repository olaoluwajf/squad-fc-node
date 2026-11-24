import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { PublicStats } from "../lib/types";

export function useStats(intervalMs = 8000) {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { setStats(await api.get<PublicStats>("/api/stats")); setError(null); }
    catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, intervalMs);
    return () => clearInterval(t);
  }, [refresh, intervalMs]);
  return { stats, error, refresh };
}
