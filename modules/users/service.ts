import "server-only";

import { hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadSchoolSettings } from "@/lib/school-settings-server";
import {
  normalizeUsername,
  suggestUsername,
  uniqueUsername,
} from "@/modules/users/enums";

/**
 * Writes and invariants for the users module.
 *
 * ── Why account creation lives here and not in the HR module ────────────────
 * A school hires somebody and wants them able to sign in, so the staff form
 * grows a "create a login" switch — but a `User`, a `Profile` and a
 * `Membership` are not the HR module's rows to write. Putting the statements
 * behind this function keeps the ownership straight and, more usefully, keeps
 * one answer to the questions every account has to settle: how the username is
 * chosen when two people share a name, and which school's defaults the new
 * account starts in.
 */

/** A free username built from the name, never colliding with an existing one. */
export async function allocateUsername(
  firstName: string,
  lastName: string,
  preferred?: string | null,
): Promise<string> {
  const base = preferred
    ? normalizeUsername(preferred)
    : suggestUsername(firstName, lastName);
  if (base === "") return "";

  /*
    Every username, not just the near misses.

    A `startsWith` would be narrower, but `uniqueUsername` appends a digit and
    `k.bennis2` does not start with anything a prefix scan on `k.bennis` would
    reliably bound once the base is truncated to fit the length limit. A school
    has hundreds of accounts, not millions, so reading the column is cheaper
    than being clever about it and cannot be wrong.
  */
  const held = await db.user.findMany({
    where: { username: { not: null } },
    select: { username: true },
  });

  return uniqueUsername(
    base,
    new Set(held.map((row) => row.username as string)),
  );
}

export type StaffAccountInput = {
  organizationId: string;
  /** The school the new account is a member of, and whose defaults it starts in. */
  schoolId: string;
  /** The role granted in that school. Null grants a login and no permissions. */
  roleId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  /** Blank to have one built from the name — see `allocateUsername`. */
  username: string | null;
  password: string;
  phone: string | null;
  jobTitle: string | null;
};

export type StaffAccountResult =
  | { ok: true; userId: string; username: string }
  | { ok: false; reason: "email-taken" | "username-taken" | "no-username" };

/**
 * Creates the login account for a member of staff, in one transaction.
 *
 * Refuses rather than repairs. A taken email or username comes back as a reason
 * the form can put against the right field — the alternative is letting the
 * unique index throw, which reaches the user as "something went wrong" and
 * leaves them guessing which of the two fields to change.
 *
 * `no-username` is the case a name in Arabic script produces: `suggestUsername`
 * has nothing ASCII to build from, so the school is asked to supply one rather
 * than being handed an account nobody can sign into.
 */
export async function createStaffAccount(
  input: StaffAccountInput,
): Promise<StaffAccountResult> {
  const email = input.email.trim().toLowerCase();

  const emailTaken = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (emailTaken) return { ok: false, reason: "email-taken" };

  // A username the school typed is honoured exactly, so a clash is reported
  // rather than silently renamed to `k.bennis2` behind their back. Only a
  // *generated* one is allowed to take a suffix.
  if (input.username) {
    const held = await db.user.findUnique({
      where: { username: normalizeUsername(input.username) },
      select: { id: true },
    });
    if (held) return { ok: false, reason: "username-taken" };
  }

  const username = await allocateUsername(
    input.firstName,
    input.lastName,
    input.username,
  );
  if (username === "") return { ok: false, reason: "no-username" };

  /*
    The new account starts in its own school's language and colour, exactly as
    one created from the user form does — see the note there. Only a starting
    point: the moment they open /appearance, the choice is theirs.
  */
  const settings = await loadSchoolSettings(input.schoolId);
  const passwordHash = await hashPassword(input.password);

  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        organizationId: input.organizationId,
        email,
        username,
        passwordHash,
        isActive: true,
        currentSchoolId: input.schoolId,
        profile: {
          create: {
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
            jobTitle: input.jobTitle,
            locale: settings.defaultLocale,
            accent: settings.defaultAccent,
          },
        },
        // No role is a real answer: a caretaker may need a login for the
        // parents' chat and nothing else. It is not a half-finished account.
        ...(input.roleId
          ? {
              memberships: {
                create: { schoolId: input.schoolId, roleId: input.roleId },
              },
            }
          : {}),
      },
      select: { id: true },
    });

    return created;
  });

  return { ok: true, userId: user.id, username };
}
