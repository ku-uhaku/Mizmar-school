"use server";

import { refresh } from "next/cache";

import {
  failure,
  success,
  successWith,
  type ActionState,
  type ActionStateWith,
} from "@/lib/action-state";
import { withCodeRetry } from "@/lib/allocation";
import { authorizeSchool, requireAuth } from "@/lib/dal";
import { generatePassword, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/format";
import { PERMISSIONS } from "@/lib/permissions";
import { boolField, field, withActionErrors } from "@/lib/server-action";
import { formValues } from "@/lib/form-values";
import { fieldErrors } from "@/lib/validation";
import {
  allocateFamilyCode,
  clearOtherPrimaryContacts,
  ensurePrimaryContact,
  findPortalHolder,
  makePrimaryContact,
  openPortalAccessFor,
  refreshPortalAccess,
  relationshipTaken,
  transferFamily,
  type IssuedPortalCredentials,
} from "@/modules/families/service";
import {
  familySchema,
  firstContactSchema,
  guardianSchema,
  portalPasswordSchema,
} from "@/modules/families/validation";
import { suggestUsername } from "@/modules/users/enums";
import {
  allocateUsername,
  createLoginAccount,
} from "@/modules/users/service";

/**
 * Actions for the families module.
 *
 * Two rules hold throughout, and they are what keeps a dossier from another
 * school being reachable by POST:
 *
 *   * the school is taken from the working context, never from the form;
 *   * a guardian is authorized through its family, resolved from the database.
 */

function readFamilyForm(formData: FormData) {
  return {
    code: field(formData, "code"),
    name: field(formData, "name"),
    nameAr: field(formData, "nameAr"),
    situation: field(formData, "situation"),
    addressLine: field(formData, "addressLine"),
    city: field(formData, "city"),
    postalCode: field(formData, "postalCode"),
    country: field(formData, "country"),
    phone: field(formData, "phone"),
    email: field(formData, "email"),
    notes: field(formData, "notes"),
    isActive: boolField(formData, "isActive"),
  };
}

function readFirstContactForm(formData: FormData) {
  return {
    guardianRelationship: field(formData, "guardianRelationship"),
    guardianFirstName: field(formData, "guardianFirstName"),
    guardianLastName: field(formData, "guardianLastName"),
    guardianPhone: field(formData, "guardianPhone"),
  };
}

function readGuardianForm(formData: FormData) {
  return {
    relationship: field(formData, "relationship"),
    firstName: field(formData, "firstName"),
    lastName: field(formData, "lastName"),
    nameAr: field(formData, "nameAr"),
    nationalId: field(formData, "nationalId"),
    phone: field(formData, "phone"),
    phoneAlt: field(formData, "phoneAlt"),
    email: field(formData, "email"),
    parentJobId: field(formData, "parentJobId"),
    employer: field(formData, "employer"),
    addressLine: field(formData, "addressLine"),
    city: field(formData, "city"),
    isPrimaryContact: boolField(formData, "isPrimaryContact"),
    isEmergencyContact: boolField(formData, "isEmergencyContact"),
    canPickUp: boolField(formData, "canPickUp"),
    notes: field(formData, "notes"),
    isActive: boolField(formData, "isActive"),
  };
}

/**
 * Resolves a family from its id and authorizes against the school that owns it.
 * The id is only ever used to *find* the row — what the caller may do with it is
 * decided by the school it turns out to belong to.
 */
async function authorizeFamily(
  familyId: string,
  permission:
    | typeof PERMISSIONS.FAMILY_VIEW
    | typeof PERMISSIONS.FAMILY_UPDATE
    | typeof PERMISSIONS.FAMILY_DELETE
    | typeof PERMISSIONS.FAMILY_PORTAL,
) {
  const family = await db.family.findUnique({
    where: { id: familyId },
    // The code comes back so an edit can keep it — see `updateFamilyAction`;
    // the name and the school's, so an access opened here can print its slip.
    select: {
      id: true,
      schoolId: true,
      code: true,
      name: true,
      school: { select: { name: true } },
    },
  });
  if (!family) return null;

  await authorizeSchool(family.schoolId, permission);
  return family;
}

/** What creating a family hands back: the file itself, plus the first
 * contact's credentials when a portal access could be opened for them. */
export type FamilyCreated = {
  familyId: string;
  credentials: IssuedPortalCredentials | null;
};

export async function createFamilyAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionStateWith<FamilyCreated>> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await requireAuth();

    const schoolId = context.currentSchool?.id;
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.FAMILY_CREATE);

    const parsed = familySchema(t).safeParse(readFamilyForm(formData));
    const parsedContact = firstContactSchema(t).safeParse(
      readFirstContactForm(formData),
    );
    if (!parsed.success || !parsedContact.success) {
      return failure(
        t.errors.invalid,
        {
          ...(parsed.success ? {} : fieldErrors(parsed.error)),
          ...(parsedContact.success ? {} : fieldErrors(parsedContact.error)),
        },
        formValues(formData),
      );
    }

    // A code the secretary typed is checked and refused; a generated one is
    // retried instead, because losing the race to another guichet is not the
    // same thing as asking for a code somebody already holds. See
    // lib/allocation.ts.
    if (parsed.data.code) {
      const duplicate = await db.family.findUnique({
        where: { schoolId_code: { schoolId, code: parsed.data.code } },
        select: { id: true },
      });
      if (duplicate) {
        return failure(t.family.codeTaken, { code: t.family.codeTaken });
      }
    }

    const create = (code: string) =>
      db.family.create({ data: { ...parsed.data, code, schoolId } });

    // The allocation is inside the retry: re-running the insert with the code
    // it already lost would fail identically five times over.
    const family = await (parsed.data.code
      ? create(parsed.data.code)
      : withCodeRetry(async () => create(await allocateFamilyCode(schoolId))));

    /*
      The first contact is created with the dossier rather than afterward on
      the detail screen — a file opened over the phone already has a name and
      a number, and that is also everything `openPortalAccessFor` needs. The
      office never types or picks a password: one is generated and handed back
      once, exactly as it would be for the second guardian onward.
    */
    const guardian = await db.guardian.create({
      data: {
        familyId: family.id,
        relationship: parsedContact.data.guardianRelationship,
        firstName: parsedContact.data.guardianFirstName,
        lastName: parsedContact.data.guardianLastName,
        phone: parsedContact.data.guardianPhone ?? parsed.data.phone,
        isPrimaryContact: true,
        isEmergencyContact: false,
        canPickUp: true,
        isActive: true,
      },
    });

    const issued = await openPortalAccessFor(guardian.id);

    refresh();
    return successWith(
      {
        familyId: family.id,
        credentials: issued
          ? {
              ...issued,
              guardianName:
                `${guardian.firstName} ${guardian.lastName}`.trim(),
              familyName: family.name,
              familyCode: family.code,
              schoolName: context.currentSchool?.name ?? "",
            }
          : null,
      },
      t.family.created,
    );
  });
}

export async function updateFamilyAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const familyId = field(formData, "id");

    const existing = await authorizeFamily(familyId, PERMISSIONS.FAMILY_UPDATE);
    if (!existing) return failure(t.errors.notFound);

    const parsed = familySchema(t).safeParse(readFamilyForm(formData));
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    /*
      Blank means "leave it as it is", not "give me a new one".

      Allocation belongs to opening a file — see `allocateFamilyCode`, whose own
      note says as much. On an edit it renumbered the dossier: a secretary who
      cleared the field, or any request that simply did not carry it, walked
      away with a family filed under a different number from the one on every
      piece of paper they had already been given.
    */
    const code = parsed.data.code ?? existing.code;

    const duplicate = await db.family.findFirst({
      where: { schoolId: existing.schoolId, code, NOT: { id: familyId } },
      select: { id: true },
    });
    if (duplicate) {
      return failure(t.family.codeTaken, { code: t.family.codeTaken });
    }

    await db.family.update({
      where: { id: familyId },
      data: { ...parsed.data, code },
    });

    refresh();
    return success(t.family.updated);
  });
}

export async function deleteFamilyAction(
  familyId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const existing = await authorizeFamily(familyId, PERMISSIONS.FAMILY_DELETE);
    if (!existing) return failure(t.errors.notFound);

    // Children survive their dossier (Student.familyId is SetNull), but
    // deleting a file that still has pupils on it is almost always a mistake —
    // detach them deliberately first.
    const childCount = await db.student.count({ where: { familyId } });
    if (childCount > 0) return failure(t.family.hasChildren);

    await db.family.delete({ where: { id: familyId } });

    refresh();
    return success(t.family.deleted);
  });
}

export async function saveGuardianAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionStateWith<IssuedPortalCredentials>> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const familyId = field(formData, "familyId");
    const guardianId = field(formData, "id");
    /** Set only when this call opened the household's access — see below. */
    let issued: { username: string; password: string } | null = null;

    const family = await authorizeFamily(familyId, PERMISSIONS.FAMILY_UPDATE);
    if (!family) return failure(t.errors.notFound);

    const parsed = guardianSchema(t).safeParse(readGuardianForm(formData));
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    // At most one father and one mother — see SINGULAR_RELATIONSHIPS.
    if (
      await relationshipTaken(
        familyId,
        parsed.data.relationship,
        guardianId || undefined,
      )
    ) {
      return failure(t.family.relationshipTaken, {
        relationship: t.family.relationshipTaken,
      });
    }

    /*
      The guardian is resolved before anything is demoted.

      Promoting a first contact clears whoever held it, and that used to run
      ahead of the write — so a `guardianId` belonging to another dossier
      demoted this family's first contact and *then* reported not-found. The
      repair, `ensurePrimaryContact`, sits after the early return and never ran,
      which left the dossier in exactly the state it exists to prevent: a file
      with nobody to ring.
    */
    if (guardianId) {
      const target = await db.guardian.findFirst({
        where: { id: guardianId, familyId },
        select: { id: true },
      });
      if (!target) return failure(t.errors.notFound);
    }

    if (parsed.data.isPrimaryContact) {
      await clearOtherPrimaryContacts(familyId, guardianId || undefined);
    }

    if (guardianId) {
      // Scoped by familyId as well as id, so a guardian id from another dossier
      // simply matches nothing instead of being edited.
      const updated = await db.guardian.updateMany({
        where: { id: guardianId, familyId },
        data: parsed.data,
      });
      if (updated.count === 0) return failure(t.errors.notFound);
    } else {
      const created = await db.guardian.create({
        data: { ...parsed.data, familyId },
      });
      /*
        The dossier's access, opened with its first guardian rather than waiting
        for somebody to remember. It is born switched off — a family with no
        child enrolled this year cannot sign in — and switches itself on at the
        first enrolment. See `openPortalAccessFor`.

        The credentials are returned so the office can hand them over now: this
        is the only moment the password exists in readable form, and after it
        the way back is a reset, exactly as for a member of staff.
      */
      issued = await openPortalAccessFor(created.id);
    }

    await ensurePrimaryContact(familyId);

    refresh();

    if (issued) {
      return successWith(
        {
          ...issued,
          guardianName: `${parsed.data.firstName} ${parsed.data.lastName}`.trim(),
          familyName: family.name,
          familyCode: family.code,
          schoolName: family.school?.name ?? "",
        },
        t.family.portalOpened,
      );
    }

    return success(
      guardianId ? t.family.guardianUpdated : t.family.guardianAdded,
    );
  });
}

export async function deleteGuardianAction(
  guardianId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const guardian = await db.guardian.findUnique({
      where: { id: guardianId },
      select: {
        id: true,
        familyId: true,
        family: { select: { schoolId: true } },
      },
    });
    if (!guardian) return failure(t.errors.notFound);

    await authorizeSchool(guardian.family.schoolId, PERMISSIONS.FAMILY_UPDATE);

    await db.guardian.delete({ where: { id: guardianId } });
    // The dossier must not be left without somebody to ring.
    await ensurePrimaryContact(guardian.familyId);

    refresh();
    return success(t.family.guardianDeleted);
  });
}

/**
 * The parent portal: opening an account, reissuing its password, withdrawing it.
 *
 * These three do *not* go through `guardianSchema`, and must not: `Guardian.userId`
 * is deliberately not a dossier field, so the guardian form strips it. Access is
 * granted here or nowhere.
 *
 * All three resolve the guardian first and authorize against the school that
 * turns out to own the dossier — an id from the request never decides what may
 * be done with it.
 */
async function authorizeGuardianPortal(guardianId: string) {
  const guardian = await db.guardian.findUnique({
    where: { id: guardianId },
    select: {
      id: true,
      familyId: true,
      firstName: true,
      lastName: true,
      phone: true,
      userId: true,
      family: {
        select: {
          schoolId: true,
          code: true,
          name: true,
          school: { select: { name: true } },
        },
      },
    },
  });
  if (!guardian) return null;

  await authorizeSchool(guardian.family.schoolId, PERMISSIONS.FAMILY_PORTAL);
  return guardian;
}

function slip(
  guardian: NonNullable<Awaited<ReturnType<typeof authorizeGuardianPortal>>>,
  username: string,
  password: string,
): IssuedPortalCredentials {
  return {
    username,
    password,
    guardianName: `${guardian.firstName} ${guardian.lastName}`.trim(),
    familyName: guardian.family.name,
    familyCode: guardian.family.code,
    schoolName: guardian.family.school.name,
  };
}

/**
 * A password typed by the office, or one generated when the field was left
 * empty.
 *
 * Returns the failure message rather than throwing, because "too short" is an
 * expected answer to a form and belongs in the dialog beside the field.
 */
function resolveChosenPassword(
  chosen: string | undefined,
  t: Awaited<ReturnType<typeof getDictionary>>,
): { ok: true; password: string } | { ok: false; message: string } {
  if (!chosen) return { ok: true, password: generatePassword() };

  const parsed = portalPasswordSchema(t).safeParse({ password: chosen });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? t.errors.invalid,
    };
  }

  return { ok: true, password: parsed.data.password };
}

export async function openPortalAccountAction(
  guardianId: string,
  /** Typed by the office; generated when omitted. */
  chosenPassword?: string,
): Promise<ActionStateWith<IssuedPortalCredentials>> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await requireAuth();

    const guardian = await authorizeGuardianPortal(guardianId);
    if (!guardian) return failure(t.errors.notFound);

    /*
      One access per family. Deliberately looks across the whole dossier rather
      than at this guardian alone, so re-opening an account that already exists
      and opening a second one for the other parent give the same answer — and
      the message can always name whoever holds it.
    */
    const holder = await findPortalHolder(guardian.familyId);
    if (holder) {
      return failure(
        interpolate(t.family.portalAlreadyOpen, {
          name: `${holder.firstName} ${holder.lastName}`.trim(),
        }),
      );
    }

    // Before any name or address is claimed: a password too short to be one is
    // a typing mistake, and it should cost the dossier nothing.
    const chosen = resolveChosenPassword(chosenPassword, t);
    if (!chosen.ok) return failure(chosen.message);
    const password = chosen.password;

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
    if (!username) return failure(t.family.portalNoUsername);

    const account = await createLoginAccount({
      organizationId: context.organization.id,
      schoolId: guardian.family.schoolId,
      // No role and therefore no membership: a parent is not staff, and
      // everything they may read is scoped by the household instead.
      roleId: null,
      firstName: guardian.firstName,
      lastName: guardian.lastName,
      // No address on the account — see `openPortalAccessFor` in service.ts.
      email: null,
      username,
      password,
      phone: guardian.phone,
      jobFunctionId: null,
    });

    if (!account.ok) {
      return failure(
        account.reason === "no-username"
          ? t.family.portalNoUsername
          : t.errors.unexpected,
      );
    }

    await db.guardian.update({
      where: { id: guardianId },
      data: { userId: account.userId },
    });

    refresh();
    return successWith(
      slip(guardian, account.username, password),
      t.family.portalOpened,
    );
  });
}

export async function resetPortalPasswordAction(
  guardianId: string,
  /** Typed by the office; generated when omitted. */
  chosenPassword?: string,
): Promise<ActionStateWith<IssuedPortalCredentials>> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const guardian = await authorizeGuardianPortal(guardianId);
    if (!guardian) return failure(t.errors.notFound);
    if (!guardian.userId) return failure(t.family.portalNoAccount);

    const chosen = resolveChosenPassword(chosenPassword, t);
    if (!chosen.ok) return failure(chosen.message);
    const password = chosen.password;

    /*
      `credentialsChangedAt` is what makes this a reset rather than a gesture.
      Both mobile tokens carry the value that was current when they were issued
      and lib/dal.ts refuses anything older, so without the stamp a refresh token
      already on somebody's phone stays good for its full sixty days and the new
      password changes nothing for whoever had the old one.
    */
    const account = await db.user.update({
      where: { id: guardian.userId },
      data: {
        passwordHash: await hashPassword(password),
        credentialsChangedAt: new Date(),
      },
      select: { username: true },
    });

    /*
      A reset used to force `isActive: true`, on the reasoning that it is how a
      school lets a parent back in after a withdrawal. It is not, any more:
      whether the household may sign in is derived from its children's
      enrolments, and a reset that overrode that would hand back a login to a
      family with nobody at the school — and nothing would take it away again
      until the next enrolment moved. So the password changes and the answer to
      "may they sign in" is re-asked, not asserted.
    */
    await refreshPortalAccess(guardian.familyId);

    refresh();
    return successWith(
      slip(guardian, account.username ?? "", password),
      t.family.portalPasswordReset,
    );
  });
}

export async function revokePortalAccountAction(
  guardianId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const guardian = await authorizeGuardianPortal(guardianId);
    if (!guardian) return failure(t.errors.notFound);
    if (!guardian.userId) return failure(t.family.portalNoAccount);

    /*
      Deactivated and unlinked, never deleted: `ChatMessage.authorId` is
      Restrict, so a parent who has written in the parents' space cannot be
      removed — and what they wrote should outlive their access anyway. The stamp
      evicts the tokens already issued; clearing the link frees the dossier to be
      given a fresh account.
    */
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: guardian.userId as string },
        data: { isActive: false, credentialsChangedAt: new Date() },
      });
      await tx.guardian.update({
        where: { id: guardianId },
        data: { userId: null },
      });
    });

    refresh();
    return success(t.family.portalAccountRevoked);
  });
}

export async function setPrimaryContactAction(
  guardianId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const guardian = await db.guardian.findUnique({
      where: { id: guardianId },
      select: {
        id: true,
        familyId: true,
        family: { select: { schoolId: true } },
      },
    });
    if (!guardian) return failure(t.errors.notFound);

    await authorizeSchool(guardian.family.schoolId, PERMISSIONS.FAMILY_UPDATE);

    await makePrimaryContact(guardian.familyId, guardianId);

    refresh();
    return success(t.family.guardianUpdated);
  });
}

// ── Moving a dossier to another school ───────────────────────────────────────

/**
 * Moves a dossier opened against the wrong school.
 *
 * ── Authorized in *both* schools, not one ───────────────────────────────────
 * The rule the rest of this file follows — take the school from the working
 * context, never from the form — cannot hold on its own here, because the whole
 * point is to write into a school that is not in the context. So the target is
 * asserted as its own authority: `authorizeSchool` refuses a school the session
 * cannot see at all, and then refuses it again without `family.update` in that
 * school. A secretary who may edit dossiers in Casablanca therefore cannot post
 * one of them into Rabat, which is exactly the leak the pattern exists to stop.
 *
 * What can and cannot follow the dossier is decided by `transferFamily` — see
 * the note there, which is where the invariants live.
 */
export async function transferFamilyAction(
  familyId: string,
  toSchoolId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await requireAuth();
    const fromSchoolId = context.currentSchool?.id;
    if (!fromSchoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(fromSchoolId, PERMISSIONS.FAMILY_UPDATE);
    await authorizeSchool(toSchoolId, PERMISSIONS.FAMILY_UPDATE);

    const result = await transferFamily({ familyId, fromSchoolId, toSchoolId });

    if (!result.ok) {
      if (result.reason === "blocked") {
        return failure(
          interpolate(t.family.transferBlocked, {
            reasons: result.blockers
              .map((blocker) => t.familyOptions.transferBlockers[blocker])
              .join(", "),
          }),
        );
      }
      return failure(
        result.reason === "not-found"
          ? t.errors.notFound
          : result.reason === "same-school"
            ? t.family.transferSameSchool
            : t.family.transferOtherOrganisation,
      );
    }

    /*
      The new dossier number is in the message, and the count of what had to be
      re-picked with it. Both are things the office has to know and neither is
      visible on the screen it lands back on: a matricule written on a paper file
      has just changed, and a town the new school does not keep has just been
      emptied.
    */
    refresh();
    return success(
      interpolate(t.family.transferred, {
        code: result.code,
        children: String(result.childCount),
        cleared: String(result.clearedReferences),
      }),
    );
  });
}
