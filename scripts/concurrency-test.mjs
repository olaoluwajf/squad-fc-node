// Fires 40 simultaneous registrations at a running dev server and checks the invariants. Use an empty squad.
const base = process.env.API_URL ?? "http://localhost:8787";
const positions = ["goalkeeper", "defender", "midfielder", "forward"];
const run = Date.now();
await Promise.all(Array.from({ length: 40 }, (_, i) =>
  fetch(`${base}/api/register`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name: `Load Test ${run} ${i}`, position: positions[i % 4] }) })));
const s = await (await fetch(`${base}/api/stats`)).json();
const [a, b] = s.teams;
console.log(`registered ${s.registered}/${s.total_capacity}, waiting ${s.waiting}, ${a.team_name} ${a.total}, ${b.team_name} ${b.total}`);
const ok = s.registered <= s.total_capacity && a.total <= a.capacity && b.total <= b.capacity && Math.abs(a.total - b.total) <= 1;
console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
