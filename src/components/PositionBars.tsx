import { motion } from "motion/react";
import { POSITIONS, POSITION_LABEL, type PositionCounts } from "../lib/types";

export default function PositionBars({ counts, total }: { counts: PositionCounts; total: number }) {
  return (
    <ul className="space-y-2">
      {POSITIONS.map((p) => (
        <li key={p} className="text-sm">
          <div className="flex justify-between"><span>{POSITION_LABEL[p]}s</span><span className="tabular-nums">{counts[p]}</span></div>
          <div className="h-1.5 bg-line"><motion.div className="h-full bg-forest" initial={false} animate={{ width: total ? `${(counts[p] / total) * 100}%` : "0%" }} transition={{ duration: 0.5 }} /></div>
        </li>
      ))}
    </ul>
  );
}
