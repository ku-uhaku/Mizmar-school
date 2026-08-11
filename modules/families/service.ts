import "server-only";

import { db } from "@/lib/db";
import {
  codePrefixOf,
  formatEntityCode,
  sequenceFromCode,
} from "@/lib/school-settings";
import { loadSchoolSettings } from "@/lib/school-settings-server";
import { isSingularRelationship } from "@/modules/families/enums";

/**
 * Writes and invariants for the families module.
 *
 * `actions.ts` owns the request-shaped work — authorize, parse, return an
 * `ActionState`. The rules about the data live here, so they hold whichever
 * action performs the write, and would still hold for an import script.
 */

/**
 * Allocates the next dossier number for a school, in that school's own format.
 *
 * Derived from the highest existing code for that year rather than a counter
 * table: there is no separate row to fall out of step, and a dossier deleted in
 * error does not shift every later number. Two secretaries opening a file in
 * the same second would collide, and the unique index is what catches it — the
 * caller retries.
 *
 * The format comes from the school's settings, so the scan reads the highest
 * *recognised* sequence: codes written under a previous format are skipped
 * rather than parsed as zero. That means changing the format mid-year restarts
 * the numbering at 1 under the new shape, which is what a school asking for a
 * new shape means — and the unique index still refuses an actual duplicate.
 */
export async function allocateFamilyCode(
  schoolId: string,
  year = new Date().getFullYear(),
): Promise<string> {
  const { familyCodeFormat } = await loadSchoolSettings(schoolId);
  const prefix = codePrefixOf(familyCodeFormat, year);

  /*
    Every code of the year, not the top 200 of them.

    This used to sort by `code` descending and take 200, on the reasoning that
    nothing could sort above the true maximum from further down. That holds only
    while the padding does: `code` sorts lexicographically and the sequence
    inside it is numeric, so "25/9" sorts above "25/250". A school on an
    unpadded format — `{yy}/{seq}` is offered by the setting and covered by
    lib/school-settings.test.ts — had its real highest number fall out of the
    window somewhere in the low hundreds, and quietly began re-issuing codes it
    had already given out. The default `E-{year}-{seq:4}` padded the collision
    away until the ten-thousandth dossier, which is why nobody met it.

    The sort therefore no longer decides anything and is gone. The reduce below
    was always a numeric maximum; it now takes it over the whole year. That is
    one indexed scan of one narrow column, on the prefix, once per file opened.
  */
  const candidates = await db.family.findMany({
    where: { schoolId, code: { startsWith: prefix } },
    select: { code: true },
  });

  const highest = candidates.reduce((max, row) => {
    const sequence = sequenceFromCode(familyCodeFormat, year, row.code);
    return sequence !== null && sequence > max ? sequence : max;
  }, 0);

  return formatEntityCode(familyCodeFormat, year, highest + 1);
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
 * The guardian on this dossier who already holds a portal account, if any.
 *
 * Enforces "one access per family". The rule is worth stating because the schema
 * cannot: `Guardian.userId` hangs off the guardian, so nothing stops a second
 * one being linked. It is not needed for *reach* — the portal scopes on the
 * household (see `householdScope` in modules/portal/queries.ts), so one login
 * already sees every child on the file — and a second account would only be a
 * second password for the school to keep track of and withdraw.
 *
 * Lives here rather than in the action so an import would be bound by it too.
 */
export async function findPortalHolder(
  familyId: string,
  exceptGuardianId?: string,
): Promise<{ id: string; firstName: string; lastName: string } | null> {
  return db.guardian.findFirst({
    where: {
      familyId,
      userId: { not: null },
      ...(exceptGuardianId ? { NOT: { id: exceptGuardianId } } : {}),
    },
    select: { id: true, firstName: true, lastName: true },
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
