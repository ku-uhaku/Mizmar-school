import "server-only";

import { db } from "@/lib/db";

/**
 * Writes and invariants for the school-years module.
 *
 * `actions.ts` owns the request-shaped work — authorize, parse the form, return
 * an `ActionState`. Anything that is a *rule about the data* lives here, so the
 * rule holds no matter which action (or future import script) performs the
 * write.
 */

/**
 * Enforces "at most one default year per school".
 *
 * SQLite cannot express this as a partial unique index through Prisma, so it is
 * a service-layer invariant: every write that sets `isDefault` must clear the
 * others first. `keepId` is the row being promoted, which must survive.
 */
export async function clearOtherDefaultYears(
  schoolId: string,
  keepId?: string,
): Promise<void> {
  await db.schoolYear.updateMany({
    where: {
      schoolId,
      isDefault: true,
      ...(keepId ? { NOT: { id: keepId } } : {}),
    },
    data: { isDefault: false },
  });
}

/** Promotes one year to be its school's default, demoting whichever held it. */
export async function makeDefaultYear(
  schoolId: string,
  yearId: string,
): Promise<void> {
  await clearOtherDefaultYears(schoolId, yearId);
  await db.schoolYear.update({
    where: { id: yearId },
    data: { isDefault: true },
  });
}
