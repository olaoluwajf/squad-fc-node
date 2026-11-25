# Squad FC (React + Vite + Hono + Turso/libSQL)

The Hono API stores data in Turso/libSQL. Local development uses a SQLite file; Vercel connects to a hosted Turso database.

## Run locally
1. Copy `.env.example` to `.env`.
2. Set `SESSION_SECRET`, both distinct captain codes (8+ characters), and the admin username and password (10+ characters).
3. Run `npm install`, `npm run db:migrate`, and `npm run db:seed`.
4. Run `npm run dev` (API on :8787, Vite on :5173 with an `/api` proxy).

## Deploy to Vercel with Turso
1. Install the [Turso CLI](https://docs.turso.tech/quickstart), sign in with `turso auth login`, then create a libSQL database with `turso db create squad-fc` (do not add `--tursodb`).
2. Get its URL with `turso db show squad-fc --url` and create an auth token with `turso db tokens create squad-fc`.
3. Add `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and a strong `SESSION_SECRET` to the Vercel project environment for Production.
4. Temporarily put the hosted URL/token and seed credentials in local `.env`, then run `npm run db:migrate` and `npm run db:seed` once against the hosted database. Restore the local URL (`file:local.db`) afterward.
5. Redeploy Vercel. Never expose the auth token or database URL in browser code or commit them to the repository.

Vercel deploys the frontend from `dist` and the API through `api/[...path].ts`. Database credentials are only used by the server.
The hosted database starts empty; the seed creates Team Obi and Team Prosper, but does not copy existing PostgreSQL players or other data.

## Safety model
- Registration and admin writes run in serialized write transactions.
- A database trigger rejects inserts or team moves that exceed half the total capacity.
- Capacity is the total squad size (default 24, 12 per team); decreases below current usage are rejected.
- Captain and admin credentials are bcrypt-hashed. Sessions are signed JWTs in HTTP-only, SameSite=Lax cookies.
- Five failed logins per IP in 15 minutes locks that IP out.

## Tests
- `npm test`: allocation and rebalancing unit tests.
- `npm run test:concurrency`: 40 simultaneous registrations against a running dev server (use an empty database).

## Database
`server/db/migrations` contains the SQLite-compatible schema. Local development uses `file:local.db`; hosted deployments use Turso's `libsql://` URL with `TURSO_AUTH_TOKEN`.
