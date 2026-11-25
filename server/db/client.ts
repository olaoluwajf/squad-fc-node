import { createClient, type Client, type InValue, type Transaction } from "@libsql/client";

type Executor = Pick<Client, "execute" | "executeMultiple"> | Pick<Transaction, "execute" | "executeMultiple">;
type QueryRow = Record<string, unknown>;

export interface QueryResult<T extends object = QueryRow> {
  rows: T[];
  rowCount: number;
}

const production = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
const url = process.env.TURSO_DATABASE_URL ?? (production ? undefined : "file:local.db");
if (!url) throw new Error("Missing environment variable TURSO_DATABASE_URL");

const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url.startsWith("file:") && !authToken) throw new Error("Missing environment variable TURSO_AUTH_TOKEN");

const client = createClient({ url, authToken, intMode: "number", timeout: 5000 });

class DatabaseConnection {
  constructor(private readonly executor: Executor) {}

  async query<T extends object = QueryRow>(sql: string, values: readonly InValue[] = []): Promise<QueryResult<T>> {
    const result = await this.executor.execute({
      sql: sql.replace(/\$(\d+)/g, "?$1"),
      args: [...values],
    });
    const rows = result.rows.map((row) => {
      const record: QueryRow = {};
      result.columns.forEach((column, index) => { record[column] = row[index]; });
      return record as T;
    });
    return { rows, rowCount: rows.length || result.rowsAffected };
  }

  executeMultiple(sql: string): Promise<void> {
    return this.executor.executeMultiple(sql);
  }

}

export const pool = new DatabaseConnection(client);
export type Db = DatabaseConnection;
export const closeDatabase = () => client.close();

let writeQueue: Promise<void> = Promise.resolve();

const isBusyError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const { code, extendedCode } = error as { code?: string; extendedCode?: string };
  const value = extendedCode ?? code;
  return value === "SQLITE_BUSY" || value?.startsWith("SQLITE_BUSY_")
    || value === "SQLITE_LOCKED" || value?.startsWith("SQLITE_LOCKED_")
    || value === "TRANSACTION_ACTIVE";
};

async function runTransaction<T>(fn: (c: Db) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    let transaction: Transaction | undefined;
    try {
      transaction = await client.transaction("write");
      const result = await fn(new DatabaseConnection(transaction));
      await transaction.commit();
      return result;
    } catch (error) {
      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error("Database rollback failed:", rollbackError);
        }
      }

      if (!isBusyError(error) || attempt >= 8) throw error;
      const delay = Math.min(20 * 2 ** attempt, 500) + Math.floor(Math.random() * 25);
      await new Promise((resolve) => setTimeout(resolve, delay));
    } finally {
      transaction?.close();
    }
  }
}

export function tx<T>(fn: (c: Db) => Promise<T>): Promise<T> {
  const result = writeQueue.then(() => runTransaction(fn));
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
}
