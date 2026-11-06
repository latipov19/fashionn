/**
 * `npm run db:seed`: migrates, seeds an empty catalog and creates the first admin.
 * Stop `npm run dev` first when using PGlite, because it allows only one process.
 */
import { closeDb, getDb } from "./client";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local. The environment may already carry the values.
}

await getDb();
await closeDb();
console.log("Database is migrated and seeded.");
