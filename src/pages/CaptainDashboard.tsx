import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { captainApi } from "../lib/captainApi";
import { POSITIONS, POSITION_LABEL, type Player, type Position, type PositionCounts } from "../lib/types";
import PositionBars from "../components/PositionBars";

type Squad = Awaited<ReturnType<typeof captainApi.squad>>;

export default function CaptainDashboard() {
  const [squad, setSquad] = useState<Squad | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<"" | Position>("");
  const [sort, setSort] = useState<"name" | "registered">("name");
  const [group, setGroup] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    captainApi.squad().then(setSquad).catch((e) => (e.status === 401 ? navigate("/captain") : setError(e.message)));
  }, [navigate]);

  const numbers = useMemo(() => new Map((squad?.players ?? []).map((p, i) => [p.id, i + 1])), [squad]);
  const rows = useMemo(() => (squad?.players ?? [])
    .filter((p) => (!pos || p.position === pos) && p.full_name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (sort === "name" ? a.full_name.localeCompare(b.full_name) : numbers.get(a.id)! - numbers.get(b.id)!)),
  [squad, q, pos, sort, numbers]);

  if (error) return <p className="p-10 text-sm text-red-700">Could not load squad: {error}</p>;
  if (!squad) return null;

  const counts = Object.fromEntries(POSITIONS.map((p) => [p, squad.players.filter((x) => x.position === p).length])) as PositionCounts;
  const total = squad.players.length;
  const logout = async () => { await captainApi.logout(); navigate("/captain"); };

  const row = (p: Player) => (
    <>
      <tr key={p.id} className="cursor-pointer border-b border-line hover:bg-paper" onClick={() => setOpen(open === p.id ? null : p.id)}>
        <td className="py-2 tabular-nums">{numbers.get(p.id)}</td><td>{p.full_name}</td><td>{POSITION_LABEL[p.position]}</td><td>{new Date(p.created_at).toLocaleDateString()}</td>
      </tr>
      {open === p.id && (
        <tr key={p.id + "d"} className="border-b border-line bg-paper text-xs text-muted">
          <td colSpan={4} className="px-2 py-2">Registered {new Date(p.created_at).toLocaleString()} · Player ID {p.id.slice(0, 8)} · Position {POSITION_LABEL[p.position]}</td>
        </tr>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">Captain: {squad.team.captain_name}</p>
          <h1 className="text-3xl font-extrabold tracking-tight">{squad.team.team_name}</h1>
        </div>
        <button className="btn btn-outline" onClick={logout}>Log out</button>
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <div className="card space-y-4">
          <p className="text-4xl font-extrabold tabular-nums">{total}/{squad.capacity}</p>
          <div className="h-2 bg-line"><div className="h-full bg-lime" style={{ width: `${squad.capacity ? (total / squad.capacity) * 100 : 0}%` }} /></div>
          <p className="text-sm text-muted">{squad.capacity - total} slots remaining</p>
          <PositionBars counts={counts} total={total} />
        </div>
        <div className="card">
          <div className="mb-3 flex flex-wrap gap-2">
            <input className="input min-w-40 flex-1" placeholder="Search players" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="input w-44" value={pos} onChange={(e) => setPos(e.target.value as Position | "")}>
              <option value="">All positions</option>
              {POSITIONS.map((p) => <option key={p} value={p}>{POSITION_LABEL[p]}</option>)}
            </select>
            <select className="input w-40" value={sort} onChange={(e) => setSort(e.target.value as "name" | "registered")}>
              <option value="name">Sort: A to Z</option><option value="registered">Sort: Registration</option>
            </select>
            <button className={`btn ${group ? "" : "btn-outline"}`} onClick={() => setGroup(!group)}>Group by position</button>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-muted"><th className="py-2">#</th><th>Name</th><th>Position</th><th>Registered</th></tr></thead>
            <tbody>
              {group
                ? POSITIONS.map((g) => {
                    const list = rows.filter((p) => p.position === g);
                    return list.length ? [
                      <tr key={g} className="bg-paper"><td colSpan={4} className="px-2 py-1 text-xs font-semibold uppercase tracking-widest text-muted">{POSITION_LABEL[g]}s ({list.length})</td></tr>,
                      ...list.map(row),
                    ] : null;
                  })
                : rows.map(row)}
            </tbody>
          </table>
          {rows.length === 0 && <p className="py-6 text-center text-sm text-muted">No players found.</p>}
        </div>
      </div>
    </div>
  );
}
