import "server-only";

import { db } from "@/lib/db";
import {
  dedupeKeyFor,
  type NotificationKind,
} from "@/modules/notifications/enums";

/**
 * Raising notifications, and working out who gets them.
 *
 * ── Why the resolvers live here and not in the modules that call them ───────
 * "Every guardian of this class" and "every desk that may answer a request" are
 * questions about *delivery*, not about events or dossiers. Left in each
 * calling module they would be written six times and would drift six ways —
 * one of them forgetting `isActive`, another forgetting that an org-wide role
 * counts. There is one copy of each here, and the modules pass ids.
 *
 * ── Nothing raised here may break the write that caused it ──────────────────
 * Every trigger goes through `dispatch`, which swallows and logs. That is a
 * deliberate exception to the house rule that genuine bugs throw: the fact has
 * already happened — the payment is taken, the bulletin is out — and rolling it
 * back because an inbox could not be written would be far worse than a family
 * not being told. The action's own result is never affected.
 *
 * The guard is at the boundary and not inside `notify`, which is where it
 * started out and where it was not enough: resolving the recipients is a read
 * of somebody else's tables, so `guardiansOfClass` throwing would have taken
 * the publish down with it while `notify` sat there catching nothing.
 */

/**
 * Runs one trigger's whole fan-out — resolving the recipients included — and
 * refuses to let any of it reach the caller.
 *
 * `label` is only for the log line. It is the thing somebody greps for when a
 * school says they were not told about something.
 */
export async function dispatch(
  label: string,
  work: () => Promise<unknown>,
): Promise<void> {
  try {
    await work();
  } catch (error) {
    console.error("[notifications]", label, error);
  }
}

/** One recipient, and what makes the line about *them* rather than in general. */
export type NotificationTarget = {
  userId: string;
  /** The child this line concerns, for the kinds that concern one. */
  studentId?: string | null;
  /** Merged over the shared params — typically the child's name. */
  params?: Record<string, string | number | null | undefined>;
};

export type NotifyInput = {
  organizationId: string;
  /** Null only for a notification that is not about one school. */
  schoolId: string | null;
  kind: NotificationKind;
  /** The row it opens — see `Notification.subjectId`. */
  subjectId?: string | null;
  /** Shared substitution values. Merged under each target's own. */
  params?: Record<string, string | number | null | undefined>;
  /**
   * What makes this notification different from the last one about the same
   * row — a status, typically. See `dedupeKeyFor`.
   */
  dedupeOn?: string | null;
  targets: NotificationTarget[];
};

/** Drops nulls and stringifies, so `params` is always a flat string map. */
function encodeParams(
  ...sources: (Record<string, string | number | null | undefined> | undefined)[]
): string {
  const merged: Record<string, string> = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      if (value === null || value === undefined) continue;
      merged[key] = String(value);
    }
  }
  return JSON.stringify(merged);
}

/**
 * Writes one notification per target.
 *
 * Deduplicated per recipient through `dedupeKey`, and the upsert's `update` is
 * deliberately empty: publishing an event twice must not resurface a line the
 * family has already read. Kinds where repetition is the point carry no key —
 * see `dedupeKeyFor` — and are written straight through.
 *
 * Returns how many rows were written, for the tests and for nothing else.
 */
export async function notify(input: NotifyInput): Promise<number> {
  // Two people can be guardians of the same child, and a guardian of two
  // children in the same class is one reader — collapse before writing so the
  // fan-out cannot hand the same person the same line twice.
  const byUser = new Map<string, NotificationTarget>();
  for (const target of input.targets) {
    if (!byUser.has(target.userId)) byUser.set(target.userId, target);
  }
  const targets = [...byUser.values()];
  if (targets.length === 0) return 0;

  const subjectId = input.subjectId ?? null;
  const dedupeKey = dedupeKeyFor(input.kind, subjectId, input.dedupeOn);

  const rows = targets.map((target) => ({
    organizationId: input.organizationId,
    schoolId: input.schoolId,
    userId: target.userId,
    studentId: target.studentId ?? null,
    kind: input.kind,
    params: encodeParams(input.params, target.params),
    subjectId,
    dedupeKey,
  }));

  if (dedupeKey === null) {
    const created = await db.notification.createMany({ data: rows });
    return created.count;
  }

  // One upsert per recipient rather than `createMany({ skipDuplicates })`,
  // which SQLite does not support. The batch is a class's worth of guardians at
  // worst, and it runs after the response's real work is done.
  await db.$transaction(
    rows.map((row) =>
      db.notification.upsert({
        where: { userId_dedupeKey: { userId: row.userId, dedupeKey } },
        create: row,
        update: {},
      }),
    ),
  );
  return rows.length;
}

// ── Who gets told ────────────────────────────────────────────────────────────

/**
 * The staff of one school who hold a code, resolved exactly as `lib/dal.ts`
 * resolves it: the super-admin flag, or an org-wide role, or the role on a
 * membership in *this* school.
 *
 * Kept in step with the DAL by hand, which is the one thing about this file
 * worth watching — a permission a director holds but is never told about is a
 * queue nobody knows is filling up. Deactivated accounts are excluded here as
 * well as at sign-in, so a leaver's inbox stops filling the day they go.
 */
export async function staffHolding(
  organizationId: string,
  schoolId: string,
  code: string,
): Promise<NotificationTarget[]> {
  const users = await db.user.findMany({
    where: {
      organizationId,
      isActive: true,
      OR: [
        { isSuperAdmin: true },
        { orgRole: { permissions: { some: { permission: { code } } } } },
        {
          memberships: {
            some: {
              schoolId,
              role: { permissions: { some: { permission: { code } } } },
            },
          },
        },
      ],
    },
    select: { id: true },
  });

  return users.map((user) => ({ userId: user.id }));
}

/**
 * The guardians of these pupils who actually have an account to read with.
 *
 * A guardian with no `userId` is a name and a phone number in the dossier and
 * nothing more — most of them are — so they are silently skipped rather than
 * counted as an unreachable recipient. Each pair carries its own `studentId`,
 * which is what lets the line say *whose* mark it is.
 */
export async function guardiansOf(
  studentIds: string[],
): Promise<NotificationTarget[]> {
  if (studentIds.length === 0) return [];

  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      family: {
        select: {
          guardians: {
            where: { isActive: true, userId: { not: null } },
            select: { userId: true },
          },
        },
      },
    },
  });

  return students.flatMap((student) =>
    // A pupil with no dossier familial attached yet has nobody to tell. Rare,
    // and not an error — the child is on the roll before the paperwork is done.
    (student.family?.guardians ?? []).map((guardian) => ({
      // Narrowed by the `where` above; Prisma cannot express that in the type.
      userId: guardian.userId as string,
      studentId: student.id,
      params: { child: `${student.firstName} ${student.lastName}` },
    })),
  );
}

/**
 * The guardians of everyone enrolled in a class — or in one half of it.
 *
 * `classGroupId` is not optional decoration: a devoir set for the TP group is
 * sat by half the class, and telling the other half about it is telling them
 * something untrue. Null means the whole class, which is what a paper with no
 * group means on `Assessment` too.
 */
export async function guardiansOfClass(
  schoolClassId: string,
  classGroupId?: string | null,
): Promise<NotificationTarget[]> {
  const enrolments = await db.enrollment.findMany({
    where: { schoolClassId, ...(classGroupId ? { classGroupId } : {}) },
    select: { studentId: true },
  });

  return guardiansOf(enrolments.map((row) => row.studentId));
}

/**
 * The guardians an announcement is aimed at: the whole school, or the classes
 * and levels named on it.
 *
 * Resolved through the enrolments of the year the event belongs to, so last
 * year's leavers are not told about this year's réunion — the audience rows
 * name a level or a class, and a level alone would otherwise match every pupil
 * who ever sat in it.
 */
export async function guardiansOfEventAudience(input: {
  schoolId: string;
  schoolYearId: string;
  isSchoolWide: boolean;
  levelIds: string[];
  classIds: string[];
}): Promise<NotificationTarget[]> {
  const enrolments = await db.enrollment.findMany({
    where: {
      schoolYearId: input.schoolYearId,
      student: { schoolId: input.schoolId },
      ...(input.isSchoolWide
        ? {}
        : {
            OR: [
              { schoolClassId: { in: input.classIds } },
              { levelOffering: { levelId: { in: input.levelIds } } },
            ],
          }),
    },
    select: { studentId: true },
  });

  return guardiansOf(enrolments.map((row) => row.studentId));
}

/** The guardians of one pupil. */
export async function guardiansOfStudent(
  studentId: string,
): Promise<NotificationTarget[]> {
  return guardiansOf([studentId]);
}

/**
 * The account behind an employment record, when there is one.
 *
 * Most of a payroll never signs in — see the note on `Staff.userId` — so this
 * answers with an empty list far more often than not, and that is not a
 * failure. A school that pays forty people and gives two of them logins should
 * notify those two and stay silent about the rest, rather than the write
 * failing or a notification being addressed to nobody.
 */
export async function staffAccount(
  staffId: string,
): Promise<NotificationTarget[]> {
  const staff = await db.staff.findUnique({
    where: { id: staffId },
    select: { userId: true, user: { select: { isActive: true } } },
  });

  if (!staff?.userId || !staff.user?.isActive) return [];
  return [{ userId: staff.userId }];
}

/**
 * The guardians on one dossier familial, without going through a pupil.
 *
 * What a receipt needs: a payment settles a *family's* schedule and may cover
 * three children at once, so there is no one child to name and none of the
 * targets carries a `studentId`. Going via `guardiansOf` would have to pick one
 * of the children arbitrarily and would then say the wrong thing.
 */
export async function guardiansOfFamily(
  familyId: string,
): Promise<NotificationTarget[]> {
  const guardians = await db.guardian.findMany({
    where: { familyId, isActive: true, userId: { not: null } },
    select: { userId: true },
  });

  return guardians.map((guardian) => ({ userId: guardian.userId as string }));
}
