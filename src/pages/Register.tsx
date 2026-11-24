import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { motion } from "motion/react";
import { useStats } from "../hooks/useStats";
import { api } from "../lib/api";
import { POSITIONS, POSITION_LABEL, type Position } from "../lib/types";

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(80, "Name is too long"),
  position: z.string().refine((v) => POSITIONS.includes(v as Position), "Choose a position"),
});
type Result = { status: "registered"; full_name: string; position: Position; team_name: string; captain_name: string }
  | { status: "waitlisted" | "duplicate" | "closed" | "full" };
const MESSAGES = {
  duplicate: "This name is already registered.", closed: "Registration is currently closed.",
  full: "Registration is full.", waitlisted: "Squads are full. You have been added to the waiting list.",
};

export default function Register() {
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const { stats } = useStats(15000);
  const closed = !!stats && !stats.registration_open;
  const full = !!stats && stats.registered >= stats.total_capacity;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ full_name: name, position });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setError(null); setLoading(true);
    let r: Result;
    try { r = await api.post<Result>("/api/register", parsed.data); }
    catch (e) { setLoading(false); return setError((e as Error).message); }
    setLoading(false);
    if (r.status === "registered" || r.status === "waitlisted") setResult(r); else setError(MESSAGES[r.status]);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      {result ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card">
          <h1 className="text-2xl font-extrabold">{result.status === "registered" ? "Registration successful!" : "You're on the waiting list"}</h1>
          {result.status === "registered" ? (
            <div className="mt-4 space-y-1 text-sm">
              <p>{result.full_name} · {POSITION_LABEL[result.position]}</p>
              <p className="text-lg font-bold">You have been assigned to {result.team_name}.</p>
              <p className="text-muted">Captain: {result.captain_name}</p>
            </div>
          ) : <p className="mt-3 text-sm text-muted">{MESSAGES.waitlisted}</p>}
          <Link to="/" className="btn mt-6">Back to home</Link>
        </motion.div>
      ) : (
        <form onSubmit={submit} className="card space-y-4" noValidate>
          <h1 className="text-2xl font-extrabold">Register</h1>
          {closed && <p className="bg-paper p-3 text-sm">Registration is currently closed.</p>}
          {!closed && full && stats?.waiting_list_enabled && <p className="bg-paper p-3 text-sm">Squads are full. Submitting adds you to the waiting list.</p>}
          <label className="block text-sm font-medium">Full name
            <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <label className="block text-sm font-medium">Playing position
            <select className="input mt-1" value={position} onChange={(e) => setPosition(e.target.value)}>
              <option value="">Select...</option>
              {POSITIONS.map((p) => <option key={p} value={p}>{POSITION_LABEL[p]}</option>)}
            </select>
          </label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button className="btn w-full" disabled={loading || closed}>{loading ? "Registering..." : "Register"}</button>
        </form>
      )}
    </div>
  );
}
