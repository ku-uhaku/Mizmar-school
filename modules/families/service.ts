import "server-only";

import { db } from "@/lib/db";
import {
  isSingularRelationship,
  nextFamilyCode,
} from "@/modules/families/enums";

/**
 * Writes and invariants for the families module.
 *
 * `actions.ts` owns the request-shaped work — authorize, parse, return an
 * `ActionState`. The rules about the data live here, so they hold whichever
 * action performs the write, and would still hold for an import script.
 */

/**
 * Allocates the next dossier number for a school, `F-<year>-<seq>`.
 *
 * Derived from the highest existing code for that year rather than a counter
 * table: there is no separate row to fall out of step, and a dossier deleted in
 * error does not shift every later number. Two secretaries opening a file in
 * the same second would collide, and the unique index is what catches it — the
 * caller retries.
 */
export async function allocateFamilyCode(
  schoolId: string,
  year = new Date().getFullYear(),
): Promise<string> {
  const prefix = nextFamilyCode(year, 0).slice(0, -4);

  const latest = await db.family.findFirst({
    where: { schoolId, code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  const lastSequence = latest ? Number(latest.code.slice(prefix.length)) : 0;
  return nextFamilyCode(year, (Number.isNaN(lastSequence) ? 0 : lastSequence) + 1);
}

/**
 * Enforces "at most one primary contact per family".
 *
 * SQLite cannot express this as a partial unique index through Prisma, so every
 * write that sets `isPrimaryContact` must clear the others first — the same
 * shape as the default school year. `keepId` is the guardian being promoted.
 */
export async function clearOtherPrimaryContacts(
  familyId: string,
  keepId?: string,
): Promise<void> {
  await db.guardian.updateMany({
    where: {
      familyId,
      isPrimaryContact: true,
      ...(keepId ? { NOT: { id: keepId } } : {}),
    },
    data: { isPrimaryContact: false },
  });
}

/**
 * True when adding (or re-assigning) this relationship would give the family a
 * second father or a second mother. Tuteurs are unlimited — see
 * SINGULAR_RELATIONSHIPS.
 *
 * `exceptGuardianId` is the row being edited, which must not conflict with
 * itself.
 */
export async function relationshipTaken(
  familyId: string,
  relationship: string,
  exceptGuardianId?: string,
): Promise<boolean> {
  if (!isSingularRelationship(relationship)) return false;

  const existing = await db.guardian.findFirst({
    where: {
      familyId,
      relationship,
      ...(exceptGuardianId ? { NOT: { id: exceptGuardianId } } : {}),
    },
    select: { id: true },
  });

  return existing !== null;
}

/**
 * Promotes a guardian to first contact, demoting whichever held it.
 *
 * Also used when a dossier's only guardian is deleted: the caller promotes the
 * next one so the school is never left with a file it cannot ring.
 */
export async function makePrimaryContact(
  familyId: string,
  guardianId: string,
): Promise<void> {
  await clearOtherPrimaryContacts(familyId, guardianId);
  await db.guardian.update({
    where: { id: guardianId },
    data: { isPrimaryContact: true },
  });
}

/**
 * Makes sure a dossier still has somebody flagged as first contact after a
 * change. Does nothing when one is already set, or when nobody is left.
 */
export async function ensurePrimaryContact(familyId: string): Promise<void> {
  const primary = await db.guardian.findFirst({
    where: { familyId, isPrimaryContact: true },
    select: { id: true },
  });
  if (primary) return;

  const candidate = await db.guardian.findFirst({
    where: { familyId, isActive: true },
    orderBy: [{ relationship: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  if (!candidate) return;

  await db.guardian.update({
    where: { id: candidate.id },
    data: { isPrimaryContact: true },
  });
}
