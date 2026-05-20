import { Pool } from "pg";

let pool: Pool | null = null;

function getPool() {
  if (pool) {
    return pool;
  }

  const host = process.env.POSTGRES_HOST ?? process.env.PGHOST ?? "localhost";
  const port = Number(process.env.POSTGRES_PORT ?? process.env.PGPORT ?? 5432);
  const database = process.env.POSTGRES_DB ?? process.env.PGDATABASE ?? "katana_security_db";
  const user = process.env.POSTGRES_USER ?? process.env.PGUSER ?? "postgres";
  const password = process.env.POSTGRES_PASSWORD ?? process.env.PGPASSWORD ?? "299792458.Light";

  pool = new Pool({
    host,
    port,
    database,
    user,
    password,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: false,
  });

  return pool;
}

export async function dbQuery<T>(text: string, values: unknown[] = []) {
  const activePool = getPool();
  return activePool.query<T>(text, values);
}
