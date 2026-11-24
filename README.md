# Squad FC (React + Vite + Node API + PostgreSQL)

No hosted-backend lock-in: a small Hono API talks to any PostgreSQL database through `pg`.

## Run locally
1. `docker compose up -d` (or point `DATABASE_URL` at any Postgres 13+).
2. `npm install`, copy `.env.example` to `.env`, set `SESSION_SECRET`, both captain codes (8+ chars, different),
   and the admin username and password (10+ chars).
3. `npm run db:migrate && npm run db:seed` (add `db:seed:demo` for 20 sample players on an empty squad).
4. `npm run dev` (API on :8787, Vite on :5173 with an /api proxy).

## Production
`npm run build`, then `npm start`. One Node process serves the API and the built frontend, so cookies are same-origin.
Serve over HTTPS, and set `TRUST_PROXY=1` only behind a trusted proxy (it makes rate limiting use X-Forwarded-For).

## Structure
- `server/allocation.ts` and `server/rebalance.ts`: pure allocation and rebalance logic, no I/O.
- `server/services/`: transactional operations (`registration`, `admin`, `stats`).
- `server/routes/`: HTTP routes (`public`, `captain`, `admin`). `server/auth.ts`: sessions and rate limiting.
- `server/db/`: pool, migrations, seed. `src/`: React app. `src/lib/api.ts`: the only place that calls `fetch`.

## Safety model
- Registration and every admin write run in a transaction that first locks the settings row, so counts are never stale.
- A database trigger also rejects any insert or move into a team that already holds half the total capacity.
- Capacity is the TOTAL (default 24, so 12 per team), even numbers only. Decreases below current usage are rejected.
- Captain and admin codes are bcrypt hashed. Sessions are signed JWTs in HTTP-only, SameSite=Lax cookies.
  The captain's team comes only from the signed session. Five failed logins per IP in 15 minutes locks that IP out.

## Tests
- `npm test`: unit tests for allocation (adversarial order, odd counts, random orders, capacity limits) and rebalancing.
- `npm run test:concurrency`: 40 simultaneous registrations against a running dev server (use an empty squad).

## Swapping the database
All SQL lives in `server/db/migrations` and `server/services`. Any Postgres host (Neon, Railway, Render, RDS, self-hosted)
works by changing `DATABASE_URL`. For a different engine, only `server/services/*` and `server/db/*` need changes.
