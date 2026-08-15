import "server-only";

import { generatePassword } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  codePrefixOf,
  formatEntityCode,
  sequenceFromCode,
} from "@/lib/school-settings";
import { loadSchoolSettings } from "@/lib/school-settings-server";
import { isSingularRelationship } from "@/modules/families/enums";
import { LIVE_ENROLMENT_STATUSES } from "@/modules/enrolment/enums";
import {
  allocateAccountEmail,
  allocateUsername,
  createLoginAccount,
} from "@/modules/users/service";
import { suggestUsername } from "@/modules/users/enums";

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
 * MySQL cannot express this as a partial unique index through Prisma, so every
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
 * What a school hands over when it opens or resets a family's access, and what
 * the printed slip is made from.
 *
 * The plaintext password exists only in this value, on its way to the screen
 * that shows it once — nothing stores it. The dossier's name and the school's
 * travel with it for the same reason: by the time somebody presses print there
 * is nothing left to fetch the password from, so the slip must already hold
 * everything it prints.
 */
export type IssuedPortalCredentials = {
  username: string;
  password: string;
  guardianName: string;
  familyName: string;
  familyCode: string;
  schoolName: string;
};

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


/**
 * Opens the household's portal access, if it has none.
 *
 * ── Why this is a service and not only an action ─────────────────────────────
 * A family's access is opened from three places now — the guichet's "open
 * access" button, the enrolment wizard, and the moment a dossier gets its first
 * guardian — and every one of them owes the same rules: one access per family,
 * a username derived from the guardian or falling back to the dossier number, a
 * placeholder address because the column is unique and required, and no role,
 * because a parent is not staff.
 *
 * Returns the credentials when it opened one, and `null` when the dossier
 * already had access or when there was nothing to hang it on. The plaintext
 * password is returned and never stored: it exists for as long as the caller
 * holds it, and once the office navigates away the only way back is a reset,
 * which is the same guarantee the school gets for a member of staff.
 */
export async function openPortalAccessFor(
  guardianId: string,
): Promise<{ username: string; password: string } | null> {
  const guardian = await db.guardian.findUnique({
    where: { id: guardianId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      familyId: true,
      userId: true,
      family: {
        select: { code: true, schoolId: true, school: { select: { organizationId: true } } },
      },
    },
  });
  if (!guardian || guardian.userId) return null;

  // One access per family — see `findPortalHolder` for why the rule looks at
  // the whole dossier rather than at this guardian.
  if (await findPortalHolder(guardian.familyId)) return null;

  /*
    The dossier number is the fallback, not the surname: `suggestUsername`
    returns "" for a name written in Arabic script, and a family recorded that
    way must still be reachable. A code like `f-2025-0142` satisfies
    USERNAME_PATTERN as it stands — see modules/users/enums.ts.
  */
  const base =
    suggestUsername(guardian.firstName, guardian.lastName) ||
    guardian.family.code;
  const username = await allocateUsername("", "", base);
  if (!username) return null;

  const email = await allocateAccountEmail(
    `parent.${guardian.family.code.toLowerCase()}@famille.ma`,
  );
  const password = generatePassword();

  const account = await createLoginAccount({
    organizationId: guardian.family.school.organizationId,
    schoolId: guardian.family.schoolId,
    // No role and therefore no membership: a parent is not staff, and
    // everything they may read is scoped by the household instead.
    roleId: null,
    firstName: guardian.firstName,
    lastName: guardian.lastName,
    email,
    username,
    password,
    phone: guardian.phone,
    jobFunctionId: null,
  });
  if (!account.ok) return null;

  await db.guardian.update({
    where: { id: guardian.id },
    data: { userId: account.userId },
  });

  // Born switched off unless a child of the dossier is actually enrolled — see
  // `refreshPortalAccess`.
  await refreshPortalAccess(guardian.familyId);

  return { username: account.username, password };
}

/**
 * Recomputes whether a household's portal access may sign in.
 *
 * ── The rule ────────────────────────────────────────────────────────────────
 * A family reaches the parents' app because it has a child at the school *this
 * year*. When the last live enrolment of the active year goes — the child
 * leaves, the year turns over, the enrolment is deleted — the login stops
 * working, and it starts working again by itself the day another child is
 * enrolled. Nothing is deleted: the dossier keeps its username and its history,
 * and a family returning after a year away is one enrolment away from access
 * rather than a new account and a new password.
 *
 * Derived, never typed in — the same shape as `refreshStudentStatus`, and for
 * the same reason: a flag a human maintains is a flag that goes stale, and this
 * one decides whether somebody can sign in.
 *
 * "This year" is the school's *default* year rather than whichever year the
 * operator happens to be looking at. A secretary reviewing last year's roll
 * must not switch off every parent in the school by opening a screen.
 */
export async function refreshPortalAccess(familyId: string): Promise<void> {
  const family = await db.family.findUnique({
    where: { id: familyId },
    select: { schoolId: true },
  });
  if (!family) return;

  const userIds = (
    await db.guardian.findMany({
      where: { familyId, userId: { not: null } },
      select: { userId: true },
    })
  )
    .map((guardian) => guardian.userId)
    .filter((userId): userId is string => userId !== null);

  if (userIds.length === 0) return;

  const year = await db.schoolYear.findFirst({
    where: { schoolId: family.schoolId, isDefault: true },
    select: { id: true },
  });

  const live = year
    ? await db.enrollment.count({
        where: {
          schoolYearId: year.id,
          status: { in: [...LIVE_ENROLMENT_STATUSES] },
          student: { familyId },
        },
      })
    : 0;

  await db.user.updateMany({
    where: { id: { in: userIds } },
    data: { isActive: live > 0 },
  });
}

/**
 * The same rule, reached from a pupil rather than from the dossier.
 *
 * Every place that moves an enrolment already refreshes the pupil's own status;
 * this is its sibling for the household's login, and it sits beside those calls
 * rather than inside them so the second effect is visible at the call site
 * instead of hidden in the first.
 */
export async function refreshHouseholdAccess(studentId: string): Promise<void> {
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { familyId: true },
  });
  if (!student?.familyId) return;
  await refreshPortalAccess(student.familyId);
}

/**
 * The same rule, applied to every household of a school at once.
 *
 * ── Why the year turning over needs its own pass ────────────────────────────
 * `refreshPortalAccess` is called when an enrolment moves, which covers every
 * change a family makes. It does not cover the change the *school* makes: on
 * the day the new year becomes the default, every dossier's answer changes at
 * once and not one enrolment has moved. Without this, a family whose children
 * are not yet re-enrolled would keep signing in until something happened to
 * touch one of their enrolments — which might be never.
 *
 * Two `updateMany` calls rather than one per dossier: a school has hundreds of
 * families and this runs inside the click that promotes the year.
 */
export async function refreshSchoolPortalAccess(
  schoolId: string,
): Promise<void> {
  const holders = await db.guardian.findMany({
    where: { userId: { not: null }, family: { schoolId } },
    select: { userId: true, familyId: true },
  });
  if (holders.length === 0) return;

  const year = await db.schoolYear.findFirst({
    where: { schoolId, isDefault: true },
    select: { id: true },
  });

  // The dossiers with somebody on the roll. No default year means no roll, and
  // therefore nobody signs in — which is the honest answer for a school that
  // has not said which year it is running.
  const enrolled = new Set(
    year
      ? (
          await db.enrollment.findMany({
            where: {
              schoolYearId: year.id,
              status: { in: [...LIVE_ENROLMENT_STATUSES] },
            },
            select: { student: { select: { familyId: true } } },
          })
        )
          .map((enrolment) => enrolment.student.familyId)
          .filter((familyId): familyId is string => familyId !== null)
      : [],
  );

  const on: string[] = [];
  const off: string[] = [];
  for (const holder of holders) {
    const bucket = enrolled.has(holder.familyId) ? on : off;
    bucket.push(holder.userId as string);
  }

  if (on.length > 0) {
    await db.user.updateMany({ where: { id: { in: on } }, data: { isActive: true } });
  }
  if (off.length > 0) {
    await db.user.updateMany({
      where: { id: { in: off } },
      data: { isActive: false },
    });
  }
}
