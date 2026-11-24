import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useStats } from "../hooks/useStats";
import TeamCard from "../components/TeamCard";
import { POSITIONS, POSITION_LABEL } from "../lib/types";

export default function Home() {
  const { stats, error, refresh } = useStats();
  const full = !!stats && stats.registered >= stats.total_capacity;
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-12">
      <section className="grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">Next match</p>
          <h1 className="mt-2 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">Two teams.<br />One game.<br />Let's play.</h1>
          <p className="mt-4 max-w-md text-muted">Register with your name and position. You are placed on a team automatically so both squads stay balanced.</p>
          <Link to="/register" className="btn btn-lime mt-6">{full ? "Join waiting list" : "Register now"} <ArrowRight size={16} /></Link>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">Registered</p>
          <p className="mt-1 text-5xl font-extrabold tabular-nums">{stats ? `${stats.registered} / ${stats.total_capacity}` : "..."}</p>
          <p className="mt-2 text-sm text-muted">{stats ? (stats.registration_open ? "Registration open" : "Registration closed") : ""}</p>
        </div>
      </section>
      {error && <p className="text-sm text-red-700">Could not load data: {error} <button className="underline" onClick={refresh}>Retry</button></p>}
      {stats && (
        <>
          {stats.teams.length >= 2 && (
            <section className="flex items-center justify-between bg-forest px-6 py-8 text-white">
              {[stats.teams[0], stats.teams[1]].map((t, i) => (
                <div key={t.id} className={i ? "text-right" : ""}>
                  <p className="text-3xl font-extrabold tracking-tight">{t.team_name}</p>
                  <p className="text-sm tabular-nums text-white/70">{t.total} / {t.capacity} players</p>
                </div>
              )).flatMap((el, i) => (i ? [<span key="vs" className="text-lg font-bold text-lime">VS</span>, el] : [el]))}
            </section>
          )}
          <section className="grid gap-4 md:grid-cols-2">{stats.teams.map((t) => <TeamCard key={t.id} team={t} />)}</section>
          <section className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4">
            {[["Available slots", stats.total_capacity - stats.registered], ["Waiting list", stats.waiting],
              ...POSITIONS.map((p) => [POSITION_LABEL[p] + "s", stats.positions[p]])].map(([label, v]) => (
              <div key={label as string} className="bg-white p-4"><p className="text-xs text-muted">{label}</p><p className="text-2xl font-bold tabular-nums">{v}</p></div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
