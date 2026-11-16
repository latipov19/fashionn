/**
 * `npm run admin:password`: makes the ADMIN_EMAIL account sign in with the ADMIN_PASSWORD now in
 * .env.local. For when the owner changed .env.local after the account was created (the boot step
 * only ever creates it) or lost the password. Runs on this machine only; the web app cannot reach it.
 *
 * With PGlite, stop `npm run dev` first: PGlite allows one process, and a second one would write
 * the same database files behind the server's back.
 */
import { closeDb, getDb } from "./client";
import { ADMIN_PASSWORD_MIN, resetAdminFromEnv } from "./seed";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local. The environment may already carry the values.
}

/** True when something answers on the dev server's port, which means it holds the PGlite files. */
async function devServerRunning(): Promise<boolean> {
  try {
    await fetch("http://localhost:3100/", { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}

if (!process.env.DATABASE_URL && (await devServerRunning())) {
  console.error("Dev server ishlayapti (localhost:3100). Avval uni Ctrl+C bilan toʻxtating, keyin bu buyruqni qayta ishga tushiring.");
  process.exit(1);
}

const outcome = await resetAdminFromEnv(await getDb());
await closeDb();

switch (outcome.result) {
  case "missing_env":
    console.error(".env.local faylida ADMIN_EMAIL va ADMIN_PASSWORD ikkalasi ham boʻlishi kerak.");
    process.exitCode = 1;
    break;
  case "too_short":
    console.error(`ADMIN_PASSWORD kamida ${ADMIN_PASSWORD_MIN} belgi boʻlsin. Hech narsa oʻzgarmadi.`);
    process.exitCode = 1;
    break;
  case "updated":
    console.log(`Tayyor: ${outcome.email} endi .env.local dagi yangi parol bilan kiradi (rol: ega). Eski sessiyalar yopildi: ${outcome.sessionsClosed}.`);
    break;
  case "created":
    console.log(`Tayyor: ${outcome.email} ega sifatida yaratildi va .env.local dagi parol bilan kiradi.`);
    break;
}
