import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { currentSchoolId, schoolScope } from "@/lib/scope";

/**
 * Reads for the families module.
 *
 * Every read is confined to `context.currentSchool` and never to a school id
 * from the request, so switching school in the header genuinely changes what
 * the screens manage and a crafted id cannot reach another school's dossiers.
 * The list and the detail screen go through the same clause — that is the point
 * of both living here.
 */

/** No school selected: match nothing rather than everything. */
/** The shape the families table renders. Primitives only — it crosses to the client. */
export type FamilyRow = {
  id: string;
  code: string;
  name: string;
  nameAr: string | null;
  situation: string;
  city: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  /** Who the school calls first, already resolved — the table must not re-derive it. */
  primaryContactName: string | null;
  primaryContactPhone: string | null;
  guardianCount: number;
  childCount: number;
};

export type GuardianRow = {
  id: string;
  relationship: string;
  firstName: string;
  lastName: string;
  nameAr: string | null;
  nationalId: string | null;
  phone: string | null;
  phoneAlt: string | null;
  email: string | null;
  parentJobId: string | null;
  /** What the picker showed when it was chosen. Null when none is set. */
  parentJobName: string | null;
  employer: string | null;
  addressLine: string | null;
  city: string | null;
  isPrimaryContact: boolean;
  isEmergencyContact: boolean;
  canPickUp: boolean;
  notes: string | null;
  isActive: boolean;
  /**
   * The portal login opened for this guardian, if any. Never the password —
   * there is none to read, only the hash, and the plaintext is shown once at the
   * moment it is issued and then gone.
   */
  portalAccount: { username: string | null; isActive: boolean } | null;
};

/** A family with everyone on it — what the detail screen renders. */
export type FamilyDetail = FamilyRow & {
  addressLine: string | null;
  postalCode: string | null;
  country: string;
  notes: string | null;
  guardians: GuardianRow[];
  children: {
    id: string;
    code: string;
    firstName: string;
    lastName: string;
    /** ISO — formatted per-locale on the client. */
    birthDate: string;
    gender: string;
    status: string;
    photoUrl: string | null;
  }[];
};

const GUARDIAN_ORDER = [
  // Père, mère, then tuteurs — the order the dossier is read in, and the order
  // the paper form has them in.
  { relationship: "asc" as const },
  { lastName: "asc" as const },
];

function toGuardianRow(guardian: {
  id: string;
  relationship: string;
  firstName: string;
  lastName: string;
  nameAr: string | null;
  nationalId: string | null;
  phone: string | null;
  phoneAlt: string | null;
  email: string | null;
  parentJobId: string | null;
  parentJob: { name: string } | null;
  employer: string | null;
  addressLine: string | null;
  city: string | null;
  isPrimaryContact: boolean;
  isEmergencyContact: boolean;
  canPickUp: boolean;
  notes: string | null;
  isActive: boolean;
  user: { username: string | null; isActive: boolean } | null;
}): GuardianRow {
  // The relation is flattened to its name: the panel prints the profession and
  // the form posts the id, and neither wants a nested object.
  const { user, parentJob, ...rest } = guardian;
  return { ...rest, parentJobName: parentJob?.name ?? null, portalAccount: user };
}

/**
 * The professions a guardian may be given, for the picker.
 *
 * Active ones only: `isActive` is how a school retires a duplicate without
 * rewriting the families that already named it, so an inactive row must not
 * come back through the picker. Whoever holds one keeps it — the dossier reads
 * the name off the row, not off this list.
 */
export async function listParentJobs(
  context: AuthContext,
): Promise<{ id: string; name: string }[]> {
  return db.parentJob.findMany({
    where: { schoolId: currentSchoolId(context), isActive: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
}

export async function listFamilies(context: AuthContext): Promise<FamilyRow[]> {
  const families = await db.family.findMany({
    where: schoolScope(context),
    orderBy: [{ name: "asc" }, { code: "asc" }],
    include: {
      guardians: {
        select: {
          firstName: true,
          lastName: true,
          phone: true,
          isPrimaryContact: true,
        },
      },
      _count: { select: { children: true } },
    },
  });

  return families.map((family) => {
    // Falls back to the first guardian: a dossier with nobody flagged still has
    // somebody to call, and showing "—" there would be a lie.
    const contact =
      family.guardians.find((guardian) => guardian.isPrimaryContact) ??
      family.guardians[0] ??
      null;

    return {
      id: family.id,
      code: family.code,
      name: family.name,
      nameAr: family.nameAr,
      situation: family.situation,
      city: family.city,
      phone: family.phone,
      email: family.email,
      isActive: family.isActive,
      primaryContactName: contact
        ? `${contact.firstName} ${contact.lastName}`.trim()
        : null,
      primaryContactPhone: contact?.phone ?? family.phone,
      guardianCount: family.guardians.length,
      childCount: family._count.children,
    };
  });
}

/**
 * One dossier with its guardians and children. Null when out of reach — callers
 * turn that into `notFound()`.
 */
export async function findFamily(
  context: AuthContext,
  familyId: string,
): Promise<FamilyDetail | null> {
  const family = await db.family.findFirst({
    where: { id: familyId, ...schoolScope(context) },
    include: {
      guardians: {
        orderBy: GUARDIAN_ORDER,
        include: {
          user: { select: { username: true, isActive: true } },
          // So the dossier prints the profession without a second read.
          parentJob: { select: { name: true } },
        },
      },
      children: {
        orderBy: [{ birthDate: "asc" }],
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
          birthDate: true,
          gender: true,
          status: true,
          photoUrl: true,
        },
      },
    },
  });

  if (!family) return null;

  const contact =
    family.guardians.find((guardian) => guardian.isPrimaryContact) ??
    family.guardians[0] ??
    null;

  return {
    id: family.id,
    code: family.code,
    name: family.name,
    nameAr: family.nameAr,
    situation: family.situation,
    addressLine: family.addressLine,
    city: family.city,
    postalCode: family.postalCode,
    country: family.country,
    phone: family.phone,
    email: family.email,
    notes: family.notes,
    isActive: family.isActive,
    primaryContactName: contact
      ? `${contact.firstName} ${contact.lastName}`.trim()
      : null,
    primaryContactPhone: contact?.phone ?? family.phone,
    guardianCount: family.guardians.length,
    childCount: family.children.length,
    guardians: family.guardians.map(toGuardianRow),
    children: family.children.map((child) => ({
      ...child,
      birthDate: child.birthDate.toISOString(),
    })),
  };
}

/**
 * Dossiers to choose from when opening a pupil's file. Id and label only — a
 * picker has no business loading the whole household.
 */
export async function listFamilyChoices(
  context: AuthContext,
): Promise<{ id: string; label: string }[]> {
  const families = await db.family.findMany({
    where: { ...schoolScope(context), isActive: true },
    orderBy: [{ name: "asc" }],
    select: { id: true, code: true, name: true },
  });

  return families.map((family) => ({
    id: family.id,
    label: `${family.name} — ${family.code}`,
  }));
}

/**
 * The header search. Matches a family name, a dossier number or a phone.
 *
 * SQLite's LIKE is case-insensitive for ASCII, which is what a French-language
 * name search needs; Arabic has no case, so it is unaffected. `mode: "insensitive"`
 * is deliberately not passed — the SQLite connector does not support it.
 */
export async function searchFamilies(
  context: AuthContext,
  term: string,
  take = 4,
): Promise<
  { id: string; name: string; code: string; primaryContactPhone: string | null }[]
> {
  const trimmed = term.trim();
  if (trimmed.length < 2) return [];

  const families = await db.family.findMany({
    where: {
      ...schoolScope(context),
      OR: [
        { name: { contains: trimmed } },
        { nameAr: { contains: trimmed } },
        { code: { contains: trimmed } },
        { phone: { contains: trimmed } },
        { guardians: { some: { lastName: { contains: trimmed } } } },
        { guardians: { some: { phone: { contains: trimmed } } } },
      ],
    },
    orderBy: { name: "asc" },
    take,
    select: {
      id: true,
      name: true,
      code: true,
      phone: true,
      guardians: {
        where: { isPrimaryContact: true },
        take: 1,
        select: { phone: true },
      },
    },
  });

  return families.map((family) => ({
    id: family.id,
    name: family.name,
    code: family.code,
    primaryContactPhone: family.guardians[0]?.phone ?? family.phone,
  }));
}

/** Live count for the school-life dashboard, scoped like the list. */
export function countFamilies(context: AuthContext): Promise<number> {
  return db.family.count({ where: schoolScope(context) });
}
