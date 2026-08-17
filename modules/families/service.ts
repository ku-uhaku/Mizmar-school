import "server-only";

import { generatePassword } from "@/lib/password";
import { db } from "@/lib/db";
import {
  codePrefixOf,
  formatEntityCode,
  sequenceFromCode,
} from "@/lib/school-settings";
import { loadSchoolSettings } from "@/lib/school-settings-server";
import { isSingularRelationship } from "@/modules/families/enums";
import { allocateStudentCode } from "@/modules/students/service";
import { LIVE_ENROLMENT_STATUSES } from "@/modules/enrolment/enums";
import {
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

  const password = generatePassword();

  const account = await createLoginAccount({
    organizationId: guardian.family.school.organizationId,
    schoolId: guardian.family.schoolId,
    // No role and therefore no membership: a parent is not staff, and
    // everything they may read is scoped by the household instead.
    roleId: null,
    firstName: guardian.firstName,
    lastName: guardian.lastName,
    /*
      No address on the account. The dossier already holds whatever the school
      knows of the guardian's — see Guardian.email — and nothing signs in with
      this column, so the `parent.f2025-0142@famille.ma` that used to be minted
      here only put a mailbox that does not exist into the reports that print it.
    */
    email: null,
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

// ── Moving a dossier to another school ───────────────────────────────────────

/**
 * What is keeping a dossier where it is.
 *
 * Each names a screen the office has to clear first, rather than a table: a
 * secretary can act on "this child is enrolled" and cannot act on "enrollments".
 */
export type FamilyTransferBlocker =
  | "enrolments"
  | "payments"
  | "requests"
  | "documents";

export type FamilyTransferResult =
  | {
      ok: true;
      /** The dossier number it now carries — reissued when the old one was taken. */
      code: string;
      recoded: boolean;
      /** Children moved with it, and how many matricules had to change. */
      childCount: number;
      recodedChildren: number;
      /**
       * References to the old school's own lists — the town somebody was born
       * in, a quartier, a parent's profession — that had no counterpart in the
       * new school and were therefore cleared. The office is told the number so
       * it knows to go and re-pick them; leaving them pointing at the other
       * school's rows would put one school's list on another school's screen.
       */
      clearedReferences: number;
    }
  | { ok: false; reason: "not-found" | "same-school" | "other-organisation" }
  | { ok: false; reason: "blocked"; blockers: FamilyTransferBlocker[] };

/**
 * Moves a household, its adults and its children to another school of the same
 * organisation.
 *
 * ── What may move, and what may not ─────────────────────────────────────────
 * A dossier is *identity*: who the household is, which adults are on it, which
 * children belong to it. None of that is a fact about a school year, which is
 * why it can move at all. Everything year-bound cannot: an `Enrollment` names a
 * level of one school's cursus, a class of its own drawing-up and a whole fee
 * schedule written at admission, and a `Payment` was taken into one school's
 * caisse. Re-pointing the dossier under either would leave a receipt in one
 * school's till made out to another school's family, and no reconciliation would
 * ever balance.
 *
 * So this is for the mistake it is named after — a dossier opened against the
 * wrong school and caught before the child was enrolled. Once a child is
 * enrolled the honest move is a transfer proper: withdraw here, admit there,
 * which is a decision with dates that both schools' registers record.
 *
 * ── The school's own lists ──────────────────────────────────────────────────
 * `City`, `Neighbourhood`, `ParentJob` and `DocumentType` are each school-scoped
 * — two schools keep their own towns and their own professions, deliberately, so
 * one cannot rename the other's. Every reference to one is therefore re-matched
 * **by name** in the target school's list, and cleared when it has no
 * counterpart. A pupil's pièces are the exception: `StudentDocument.documentTypeId`
 * is required, so a dossier holding a document of a type the new school does not
 * keep is refused rather than silently emptied.
 *
 * Both schools must belong to one organisation, and the caller authorizes in
 * both before calling — this writes into a school that was never in the
 * request's context.
 */
export async function transferFamily(input: {
  familyId: string;
  /** Re-derived from the session by the caller, never taken from the request. */
  fromSchoolId: string;
  toSchoolId: string;
}): Promise<FamilyTransferResult> {
  if (input.fromSchoolId === input.toSchoolId) {
    return { ok: false, reason: "same-school" };
  }

  const family = await db.family.findFirst({
    where: { id: input.familyId, schoolId: input.fromSchoolId },
    select: {
      id: true,
      code: true,
      school: { select: { organizationId: true } },
      _count: { select: { payments: true } },
      guardians: { select: { id: true, parentJobId: true, userId: true } },
      children: {
        select: {
          id: true,
          code: true,
          birthCityId: true,
          previousSchoolCityId: true,
          neighbourhoodId: true,
          _count: { select: { enrollments: true, documentRequests: true } },
          documents: { select: { id: true, documentTypeId: true } },
        },
      },
    },
  });
  if (!family) return { ok: false, reason: "not-found" };

  const target = await db.school.findUnique({
    where: { id: input.toSchoolId },
    select: { organizationId: true },
  });
  if (!target || target.organizationId !== family.school.organizationId) {
    return { ok: false, reason: "other-organisation" };
  }

  const blockers: FamilyTransferBlocker[] = [];
  if (family.children.some((child) => child._count.enrollments > 0)) {
    blockers.push("enrolments");
  }
  if (family._count.payments > 0) blockers.push("payments");
  if (family.children.some((child) => child._count.documentRequests > 0)) {
    blockers.push("requests");
  }

  // ── The lists the new school keeps, matched by name ─────────────────────────
  const referencedCityIds = unique(
    family.children.flatMap((child) =>
      [child.birthCityId, child.previousSchoolCityId].filter(isId),
    ),
  );
  const referencedNeighbourhoodIds = unique(
    family.children.map((child) => child.neighbourhoodId).filter(isId),
  );
  const referencedJobIds = unique(
    family.guardians.map((guardian) => guardian.parentJobId).filter(isId),
  );
  const referencedTypeIds = unique(
    family.children.flatMap((child) =>
      child.documents.map((document) => document.documentTypeId),
    ),
  );

  const [oldCities, oldNeighbourhoods, oldJobs, oldTypes] = await Promise.all([
    db.city.findMany({
      where: { id: { in: referencedCityIds } },
      select: { id: true, name: true },
    }),
    db.neighbourhood.findMany({
      where: { id: { in: referencedNeighbourhoodIds } },
      select: { id: true, name: true, city: { select: { name: true } } },
    }),
    db.parentJob.findMany({
      where: { id: { in: referencedJobIds } },
      select: { id: true, name: true },
    }),
    db.documentType.findMany({
      where: { id: { in: referencedTypeIds } },
      select: { id: true, code: true },
    }),
  ]);

  const [newCities, newNeighbourhoods, newJobs, newTypes] = await Promise.all([
    db.city.findMany({
      where: { schoolId: input.toSchoolId },
      select: { id: true, name: true },
    }),
    db.neighbourhood.findMany({
      where: { schoolId: input.toSchoolId },
      select: { id: true, name: true, city: { select: { name: true } } },
    }),
    db.parentJob.findMany({
      where: { schoolId: input.toSchoolId },
      select: { id: true, name: true },
    }),
    db.documentType.findMany({
      where: { schoolId: input.toSchoolId },
      select: { id: true, code: true },
    }),
  ]);

  const cityMap = matchByKey(oldCities, newCities, (row) => row.name);
  // Keyed on the town as well as the quartier: two schools may both keep a
  // "Centre", and they are not the same place.
  const neighbourhoodMap = matchByKey(
    oldNeighbourhoods,
    newNeighbourhoods,
    (row) => `${row.city.name}/${row.name}`,
  );
  const jobMap = matchByKey(oldJobs, newJobs, (row) => row.name);
  // On the code, not the name: it is what a school files a pièce under and the
  // stable half of the row — see DocumentType.
  const typeMap = matchByKey(oldTypes, newTypes, (row) => row.code);

  // A required column, so an unmatched type has nothing to fall back to.
  if ([...typeMap.values()].some((id) => id === null)) {
    blockers.push("documents");
  }

  if (blockers.length > 0) return { ok: false, reason: "blocked", blockers };

  // ── Codes ──────────────────────────────────────────────────────────────────
  const codeClash = await db.family.findFirst({
    where: { schoolId: input.toSchoolId, code: family.code },
    select: { id: true },
  });
  const code = codeClash
    ? await allocateFamilyCode(input.toSchoolId)
    : family.code;

  const takenChildCodes = new Set(
    (
      await db.student.findMany({
        where: {
          schoolId: input.toSchoolId,
          code: { in: family.children.map((child) => child.code) },
        },
        select: { code: true },
      })
    ).map((row) => row.code),
  );

  /*
    Matricules are reissued from the target school's own sequence, and reserved
    as we go: the allocator reads a table this loop has not written to yet, so
    two children of one dossier both clashing would otherwise be handed the same
    next number — and the unique index would refuse the second half of the move
    after the first half had been written.
  */
  const childCodes = new Map<string, string>();
  if (takenChildCodes.size > 0) {
    const issued = new Set<string>();
    for (const child of family.children) {
      if (!takenChildCodes.has(child.code)) continue;
      let next = await allocateStudentCode(input.toSchoolId);
      while (issued.has(next)) next = bumpSequence(next);
      issued.add(next);
      childCodes.set(child.id, next);
    }
  }

  let clearedReferences = 0;
  const resolve = (
    map: Map<string, string | null>,
    id: string | null,
  ): string | null => {
    if (id === null) return null;
    const mapped = map.get(id) ?? null;
    if (mapped === null) clearedReferences += 1;
    return mapped;
  };

  await db.$transaction(async (tx) => {
    await tx.family.update({
      where: { id: family.id },
      data: { schoolId: input.toSchoolId, code },
    });

    for (const child of family.children) {
      await tx.student.update({
        where: { id: child.id },
        data: {
          schoolId: input.toSchoolId,
          code: childCodes.get(child.id) ?? child.code,
          birthCityId: resolve(cityMap, child.birthCityId),
          previousSchoolCityId: resolve(cityMap, child.previousSchoolCityId),
          neighbourhoodId: resolve(neighbourhoodMap, child.neighbourhoodId),
        },
      });

      for (const document of child.documents) {
        await tx.studentDocument.update({
          where: { id: document.id },
          // Non-null: an unmatched type is a blocker above.
          data: {
            documentTypeId: typeMap.get(document.documentTypeId) as string,
          },
        });
      }
    }

    for (const guardian of family.guardians) {
      if (guardian.parentJobId === null) continue;
      await tx.guardian.update({
        where: { id: guardian.id },
        data: { parentJobId: resolve(jobMap, guardian.parentJobId) },
      });
    }

    /*
      The household's portal login, when it has one. A guardian holds no
      membership — everything they read is scoped by the household instead — so
      the only thing pointing at the old school is their working context, and the
      year inside it belongs to a school this account no longer touches.
    */
    const holders = family.guardians.map((guardian) => guardian.userId).filter(isId);
    if (holders.length > 0) {
      await tx.user.updateMany({
        where: { id: { in: holders }, currentSchoolId: input.fromSchoolId },
        data: { currentSchoolId: input.toSchoolId, currentSchoolYearId: null },
      });
    }
  });

  return {
    ok: true,
    code,
    recoded: code !== family.code,
    childCount: family.children.length,
    recodedChildren: childCodes.size,
    clearedReferences,
  };
}

function isId(value: string | null): value is string {
  return value !== null;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Old id → the new school's row of the same key, or null when it keeps none.
 *
 * By key rather than by id because the two lists are genuinely separate rows:
 * matching "Oujda" to "Oujda" is the whole point, and a school that has never
 * heard of the town gives null.
 */
function matchByKey<T extends { id: string }>(
  old: T[],
  fresh: T[],
  keyOf: (row: T) => string,
): Map<string, string | null> {
  const byKey = new Map(fresh.map((row) => [keyOf(row), row.id]));
  return new Map(old.map((row) => [row.id, byKey.get(keyOf(row)) ?? null]));
}

/** The next code in a series, for the one case the allocator cannot see. */
function bumpSequence(code: string): string {
  const match = code.match(/(\d+)(\D*)$/);
  if (!match || match.index === undefined) return `${code}-2`;
  const [, digits, tail] = match;
  const next = String(Number(digits) + 1).padStart(digits.length, "0");
  return code.slice(0, match.index) + next + tail;
}
