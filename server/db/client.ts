import pg from "pg";

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
export type Db = pg.Pool | pg.PoolClient;

/** Runs fn inside a transaction; rolls back on any error. */
export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    const result = await fn(c);
    await c.query("commit");
    return result;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
