import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { captainApi } from "../lib/captainApi";

export default function CaptainLogin() {
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault(); setLoading(true); setError(null);
    try { await captainApi.login(code); navigate("/captain/dashboard"); }
    catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <form onSubmit={submit} className="card space-y-4">
        <h1 className="text-2xl font-extrabold">Captain access</h1>
        <div className="relative">
          <input className="input pr-10" type={show ? "text" : "password"} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Secret access code" autoComplete="off" />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide code" : "Show code"} className="absolute right-3 top-3 text-muted">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button className="btn w-full" disabled={loading || !code}>{loading ? "Checking..." : "Log in"}</button>
      </form>
    </div>
  );
}
