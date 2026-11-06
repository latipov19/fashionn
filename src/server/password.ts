import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;

function derive(password: string, salt: Buffer, n: number, r: number, p: number, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, length, { N: n, r, p, maxmem: 256 * n * r }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/** Stored as `scrypt$N$r$p$salt$hash`, so the cost can rise later without a migration. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P, KEY_LENGTH);
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"), Number(n), Number(r), Number(p), expected.length);
  return timingSafeEqual(actual, expected);
}

/** Spends the same time as a real check when the email is unknown. */
export async function burnPasswordCheck(password: string): Promise<void> {
  await derive(password, Buffer.alloc(16), N, R, P, KEY_LENGTH);
}
