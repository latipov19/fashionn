import path from "node:path";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = PgTransaction<PgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;
export type Executor = Db | Tx;

type Connection = { db: Db; close: () => Promise<void> };

/**
 * PGlite allows one process and one client, and Next can load this module more than once,
 * so the single connection lives on globalThis.
 */
const holder = globalThis as typeof globalThis & { __vybeverseDb?: Promise<Connection> };

const migrationsFolder = () => path.join(process.cwd(), "drizzle");

async function openPglite(): Promise<Connection> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");

  // Unit tests always run in memory and can never reach .data.
  const dataDir = process.env.NODE_ENV === "test" ? "memory://" : path.join(process.cwd(), ".data", "pglite");
  if (dataDir !== "memory://") {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(dataDir, { recursive: true });
  }

  const client = new PGlite(dataDir);
  const close = () => client.close();
  try {
    await client.waitReady;
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: migrationsFolder() });
    return { db: db as unknown as Db, close };
  } catch (error) {
    await close().catch(() => undefined);
    throw error;
  }
}

async function openPostgres(url: string): Promise<Connection> {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");

  const pool = new Pool({ connectionString: url, max: 10 });
  const close = () => pool.end();
  try {
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: migrationsFolder() });
    return { db: db as unknown as Db, close };
  } catch (error) {
    await close().catch(() => undefined);
    throw error;
  }
}

async function open(): Promise<Connection> {
  const url = process.env.DATABASE_URL;
  const connection = await (url ? openPostgres(url) : openPglite());
  try {
    // Imported here because seed pulls in the content modules, which only boot needs.
    const { ensureSeeded } = await import("./seed");
    await ensureSeeded(connection.db);
    return connection;
  } catch (error) {
    await connection.close().catch(() => undefined);
    throw error;
  }
}

/** Connects, migrates and seeds on first use. Later calls share the same client. */
export function getDb(): Promise<Db> {
  if (!holder.__vybeverseDb) {
    holder.__vybeverseDb = open().catch((error) => {
      holder.__vybeverseDb = undefined;
      throw error;
    });
  }
  return holder.__vybeverseDb.then((connection) => connection.db);
}

/** Closes the connection. The next getDb() opens a new one. */
export async function closeDb(): Promise<void> {
  const pending = holder.__vybeverseDb;
  holder.__vybeverseDb = undefined;
  if (pending) await (await pending).close();
}
