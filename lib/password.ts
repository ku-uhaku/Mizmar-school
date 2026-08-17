import { randomInt } from "node:crypto";

import bcrypt from "bcryptjs";

/**
 * Hashing and minting passwords.
 *
 * ── Why this is not in lib/auth.ts ──────────────────────────────────────────
 * It was, and that made hashing a password cost an import of Auth.js. Auth.js
 * reaches `next/navigation`, which reaches React's context — fine inside the
 * app, fatal in a `tsx` script: `db:staff-classes` opens accounts through
 * `createLoginAccount` and died on `React.createContext is not a function`
 * before it had read a single row. The seeds had already worked around it by
 * calling `bcrypt.hash(password, 12)` by hand, which quietly put the cost factor
 * in two places.
 *
 * So the three functions that only need bcrypt live here, where a script, a seed
 * and a Server Action can all reach them, and `lib/auth.ts` imports them like
 * everybody else. No `server-only`: bcrypt is server-side by nature and the
 * marker would stop the seeds importing it, which is the whole point.
 */

/**
 * The bcrypt cost. Twelve, and stated once: raising it later is a decision about
 * every password in the database, not something to discover in two files that
 * disagree.
 */
const COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * A password for an account somebody else opens on a person's behalf — a
 * parent's portal login, handed over at the counter.
 *
 * The alphabet has `0/O` and `1/l/I` removed: this gets dictated down a
 * telephone or copied off a slip of paper, and a glyph nobody can read back is a
 * support call. `crypto.randomInt` rather than `Math.random` — the value is a
 * credential, and it is uniform without the modulo bias a hand-rolled version
 * would carry.
 */
const PASSWORD_ALPHABET = "abcdefghijkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generatePassword(length = 12): string {
  let password = "";
  for (let index = 0; index < length; index += 1) {
    password += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return password;
}
