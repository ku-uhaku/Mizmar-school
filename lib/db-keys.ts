/**
 * Helpers for unique constraints that involve a nullable column.
 *
 * ── The problem ───────────────────────────────────────────────────────────────
 * SQLite (like PostgreSQL, and per the SQL standard) treats NULLs as *distinct*
 * in a unique index. So this does **not** do what it looks like:
 *
 *   @@unique([levelId, trackId, subjectId])   // trackId is nullable
 *
 * Two rows with the same `levelId` and `subjectId` and `trackId = NULL` are both
 * accepted, because NULL never equals NULL. For our schema the nullable value is
 * never "unknown" — it is a meaningful "applies to all", and it is usually the
 * *commonest* row. The constraint therefore fails exactly where it matters most.
 *
 * ── The fix ───────────────────────────────────────────────────────────────────
 * Each affected table carries a small mirror column built by one of the helpers
 * below, with `""` standing in for null, and the unique index uses that instead.
 * Nothing in the index is nullable, so the database enforces the rule.
 *
 * A partial or expression index (`IFNULL(...)`) would avoid the extra column, but
 * Prisma cannot express either, and adding one through raw SQL would show up
 * forever as schema drift in `prisma migrate diff`.
 *
 * ── The rule ──────────────────────────────────────────────────────────────────
 * Whenever a write sets or changes one of the mirrored columns, it must
 * recompute the key in the same statement. Never write a key literal by hand.
 */

/** Joins id parts into a key, mapping null and undefined to "". */
export function nullableKey(
  ...parts: (string | null | undefined)[]
): string {
  return parts.map((part) => part ?? "").join(":");
}
