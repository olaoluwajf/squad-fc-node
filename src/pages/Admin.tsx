import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { adminApi } from "../lib/adminApi";
import { useStats } from "../hooks/useStats";
import { POSITIONS, POSITION_LABEL, type Player, type Position, type TeamStat } from "../lib/types";
import PositionBars from "../components/PositionBars";

type Act = (run: () => Promise<unknown>) => Promise<void>;

export default function Admin() {
  const [auth, setAuth] = useState<"loading" | "in" | "out">("loading");
  useEffect(() => { adminApi.me().then(() => setAuth("in")).catch(() => setAuth("out")); }, []);
  if (auth === "loading") return null;
  if (auth === "out") return <Login onDone={() => setAuth("in")} />;
  return <Dashboard onLogout={async () => { await adminApi.logout(); setAuth("out"); }} />;
}

function Login({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(null);
    try { await adminApi.login(username, password); onDone(); } catch (err) { setError((err as Error).message); }
  }
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <form onSubmit={submit} className="card space-y-4">
        <h1 className="text-2xl font-extrabold">Admin login</h1>
        <input className="input" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button className="btn w-full">Log in</button>
      </form>
    </div>
  );
}

interface Log { id: number; action: string; previous_value: unknown; new_value: unknown; created_at: string; admins: { username: string } | null }
interface Waiting { id: string; full_name: string; position: Position; created_at: string }

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const { stats, refresh } = useStats(5000);
  const [players, setPlayers] = useState<Player[]>([]);
  const [waiting, setWaiting] = useState<Waiting[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [capacity, setCapacity] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [q, setQ] = useState(""); const [fPos, setFPos] = useState(""); const [fTeam, setFTeam] = useState("");

  const load = useCallback(async () => {
    try { const o = await adminApi.overview(); setPlayers(o.players); setWaiting(o.waiting); setLogs(o.logs); }
    catch (e) { setMsg((e as Error).message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act: Act = async (run) => {
    try {
      const r = (await run()) as { moved?: number } | undefined;
      setMsg(r?.moved !== undefined ? `Rebalanced, ${r.moved} player(s) moved` : "Saved");
    } catch (e) { setMsg((e as Error).message); }
    await Promise.all([load(), refresh()]);
  };

  const shown = useMemo(() => players.filter((p) =>
    p.full_name.toLowerCase().includes(q.toLowerCase()) && (!fPos || p.position === fPos) && (!fTeam || String(p.team_id) === fTeam)), [players, q, fPos, fTeam]);
  if (!stats) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight">Super admin</h1>
        <button className="btn btn-outline" onClick={onLogout}>Log out</button>
      </div>
      {msg && <p role="status" className="bg-white p-3 text-sm">{msg}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-4xl font-extrabold tabular-nums">{stats.registered} / {stats.total_capacity}</p>
          <p className="text-sm text-muted">{stats.total_capacity - stats.registered} slots left · {stats.waiting} waiting · {stats.registration_open ? "open" : "closed"}</p>
          <p className="mb-4 text-sm text-muted">{stats.teams.map((t) => `${t.team_name}: ${t.total}/${t.capacity}`).join(" · ")}</p>
          <PositionBars counts={stats.positions} total={stats.registered} />
        </div>
        <div className="card space-y-3">
          <p className="font-semibold">Total capacity (even number)</p>
          <div className="flex gap-2">
            <input className="input" type="number" step={2} placeholder={String(stats.total_capacity)} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            <button className="btn" disabled={!capacity} onClick={() => act(() => adminApi.setCapacity(Number(capacity)))}>Save</button>
          </div>
          <p className="text-xs text-muted">Each team gets half of the total.</p>
          <button className="btn btn-outline w-full" onClick={() => confirm("Rebalance squads now?") && act(() => adminApi.rebalance())}>Auto rebalance</button>
        </div>
        <div className="card space-y-3">
          <p className="font-semibold">Registration</p>
          <button className="btn btn-outline w-full" onClick={() => act(() => adminApi.setRegistration(!stats.registration_open, stats.waiting_list_enabled))}>{stats.registration_open ? "Close registration" : "Open registration"}</button>
          <button className="btn btn-outline w-full" onClick={() => act(() => adminApi.setRegistration(stats.registration_open, !stats.waiting_list_enabled))}>Waiting list: {stats.waiting_list_enabled ? "on (turn off)" : "off (turn on)"}</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">{stats.teams.map((t) => <TeamForm key={t.id + t.team_name + t.captain_name} team={t} act={act} />)}</div>

      <div className="card overflow-x-auto">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="mr-2 font-semibold">Players ({shown.length})</p>
          <input className="input w-48" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input w-44" value={fPos} onChange={(e) => setFPos(e.target.value)}><option value="">All positions</option>{POSITIONS.map((p) => <option key={p} value={p}>{POSITION_LABEL[p]}</option>)}</select>
          <select className="input w-40" value={fTeam} onChange={(e) => setFTeam(e.target.value)}><option value="">All teams</option>{stats.teams.map((t) => <option key={t.id} value={t.id}>{t.team_name}</option>)}</select>
        </div>
        <table className="w-full text-sm"><tbody>{shown.map((p) => <PlayerRow key={p.id + p.full_name + p.position} p={p} teams={stats.teams} act={act} />)}</tbody></table>
      </div>

      <div className="card">
        <p className="mb-2 font-semibold">Waiting list ({waiting.length})</p>
        {waiting.length === 0 && <p className="text-sm text-muted">Nobody is waiting.</p>}
        {waiting.map((w) => (
          <div key={w.id} className="flex items-center justify-between gap-2 border-b border-line py-2 text-sm">
            <span>{w.full_name} · {POSITION_LABEL[w.position]}</span>
            <span className="flex gap-2">
              <button className="btn h-8" onClick={() => act(() => adminApi.promote(w.id))}>Promote</button>
              <button className="btn btn-outline h-8 text-red-700" onClick={() => act(() => adminApi.removeWaiting(w.id))}>Remove</button>
            </span>
          </div>
        ))}
      </div>

      <div className="card overflow-x-auto"><p className="mb-2 font-semibold">Activity log</p>
        <table className="w-full text-xs">
          <thead><tr className="text-left text-muted"><th className="py-1">When</th><th>Action</th><th>Admin</th><th>Previous</th><th>New</th></tr></thead>
          <tbody>{logs.map((l) => (
            <tr key={l.id} className="border-t border-line align-top">
              <td className="py-2">{new Date(l.created_at).toLocaleString()}</td><td>{l.action}</td><td>{l.admins?.username ?? "system"}</td>
              <td className="text-muted">{l.previous_value == null ? "" : JSON.stringify(l.previous_value)}</td><td>{l.new_value == null ? "" : JSON.stringify(l.new_value)}</td>
            </tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

function TeamForm({ team, act }: { team: TeamStat; act: Act }) {
  const [name, setName] = useState(team.team_name); const [captain, setCaptain] = useState(team.captain_name); const [code, setCode] = useState("");
  return (
    <div className="card space-y-3">
      <p className="font-semibold">Team {team.id} settings</p>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Team name" />
      <input className="input" value={captain} onChange={(e) => setCaptain(e.target.value)} aria-label="Captain name" />
      <button className="btn" onClick={() => act(() => adminApi.updateTeam(team.id, name, captain))}>Save names</button>
      <div className="flex gap-2">
        <input className="input" type="password" placeholder="New access code (8+ chars)" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="new-password" />
        <button className="btn btn-outline" disabled={code.length < 8} onClick={async () => { await act(() => adminApi.setCaptainCode(team.id, code)); setCode(""); }}>Set code</button>
      </div>
    </div>
  );
}

function PlayerRow({ p, teams, act }: { p: Player; teams: TeamStat[]; act: Act }) {
  const [edit, setEdit] = useState(false); const [name, setName] = useState(p.full_name); const [pos, setPos] = useState<Position>(p.position);
  return (
    <tr className="border-b border-line">
      <td className="py-2">{edit ? <input className="input h-8" value={name} onChange={(e) => setName(e.target.value)} /> : p.full_name}</td>
      <td>{edit ? <select className="input h-8" value={pos} onChange={(e) => setPos(e.target.value as Position)}>{POSITIONS.map((x) => <option key={x} value={x}>{POSITION_LABEL[x]}</option>)}</select> : POSITION_LABEL[p.position]}</td>
      <td><select className="input h-8 w-32" value={p.team_id} onChange={(e) => act(() => adminApi.movePlayer(p.id, Number(e.target.value)))}>{teams.map((t) => <option key={t.id} value={t.id}>{t.team_name}</option>)}</select></td>
      <td className="space-x-3 text-right">
        {edit ? (<>
          <button onClick={async () => { await act(() => adminApi.updatePlayer(p.id, name, pos)); setEdit(false); }}>Save</button>
          <button className="text-muted" onClick={() => setEdit(false)}>Cancel</button>
        </>) : <button onClick={() => setEdit(true)}>Edit</button>}
        <button className="text-red-700" onClick={() => confirm(`Remove ${p.full_name}?`) && act(() => adminApi.removePlayer(p.id))}>Remove</button>
      </td>
    </tr>
  );
}
