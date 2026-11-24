import { motion } from "motion/react";
import type { TeamStat } from "../lib/types";
import PositionBars from "./PositionBars";

export default function TeamCard({ team }: { team: TeamStat }) {
  return (
    <section className="card">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">Captain: {team.captain_name}</p>
      <h3 className="mt-1 text-2xl font-extrabold tracking-tight">{team.team_name}</h3>
      <div className="my-4">
        <div className="flex justify-between text-sm"><span>Players</span><span className="tabular-nums">{team.total}/{team.capacity}</span></div>
        <div className="mt-1 h-2 bg-line"><motion.div className="h-full bg-lime" initial={false} animate={{ width: `${team.capacity ? (team.total / team.capacity) * 100 : 0}%` }} transition={{ duration: 0.5 }} /></div>
      </div>
      <PositionBars counts={team.positions} total={team.total} />
    </section>
  );
}
