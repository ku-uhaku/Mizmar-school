/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/students/*.prisma`. Labels live in `i18n/*.ts` under
 * `studentOptions`.
 */

export const GENDERS = ["MALE", "FEMALE"] as const;
export type Gender = (typeof GENDERS)[number];

/**
 * ABO/Rh group, in the international notation.
 *
 * The only enum in this module with no entry in `studentOptions`: "O−" is
 * written "O−" on a Moroccan carnet de santé, a French one and an English one
 * alike, and putting it through a dictionary would invite three spellings of a
 * thing whose whole purpose is to be read identically under pressure.
 */
export const BLOOD_TYPES = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
] as const;
export type BloodType = (typeof BLOOD_TYPES)[number];

/**
 * The kind of establishment a transferring pupil came from.
 *
 *   PUBLIC      an école publique
 *   PRIVATE     a Moroccan private school
 *   MISSION     mission étrangère — AEFE, Cervantes, and the like
 *   HOMESCHOOL  taught at home
 *   OTHER       anything else, described in `transferReason`
 */
export const SCHOOLING_TYPES = [
  "PUBLIC",
  "PRIVATE",
  "MISSION",
  "HOMESCHOOL",
  "OTHER",
] as const;
export type SchoolingType = (typeof SCHOOLING_TYPES)[number];

/**
 * Who the child actually lives with in term time.
 *
 * Deliberately not derived from `Family.situation`: parents may be married and
 * the child still board, and divorced parents may share custody. The school
 * needs the address the child sleeps at, not the legal status of the couple.
 */
export const LIVES_WITH = [
  "BOTH_PARENTS",
  "MOTHER",
  "FATHER",
  "GUARDIAN",
  "BOARDING",
  "OTHER",
] as const;
export type LivesWith = (typeof LIVES_WITH)[number];

/**
 * Total fratrie size, derived rather than stored — a third column that can
 * disagree with the two it sums is a bug waiting to be filed. Null only when
 * neither count has been recorded, so "no siblings" and "not asked" stay
 * distinguishable.
 */
export function siblingCountOf(input: {
  brotherCount: number | null;
  sisterCount: number | null;
}): number | null {
  if (input.brotherCount === null && input.sisterCount === null) return null;
  return (input.brotherCount ?? 0) + (input.sisterCount ?? 0);
}

/**
 * Where a pupil's file has got to.
 *
 * Derived from the enrolments, never typed in — see `refreshStudentStatus` in
 * `service.ts`. Kept as a column rather than computed on read because it is
 * what the list filters and sorts by, and re-deriving it per row would mean
 * loading every enrolment to draw a table.
 *
 *   PRE_REGISTERED  a file exists; the child has no place yet
 *   ENROLLED        inscribed for a year, whether or not seated in a class
 *   TRANSFERRED     left for another school
 *   WITHDRAWN       left without transferring — abandon, non-réinscription
 *   GRADUATED       finished the school's last level
 */
export const STUDENT_STATUSES = [
  "PRE_REGISTERED",
  "ENROLLED",
  "TRANSFERRED",
  "WITHDRAWN",
  "GRADUATED",
] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

/**
 * The mapping from a pupil's enrolments to their status, kept pure so it can be
 * reasoned about — and reused by the seed — without a database round trip.
 *
 * An active enrolment beats everything: a child re-admitted after withdrawing
 * is enrolled, and the old row's status is history. With no active row, the most
 * recent enrolment says how the pupil left. With no rows at all, the file is
 * open and nothing more.
 *
 * `enrollments` must be ordered newest first. `refreshStudentStatus` in
 * `service.ts` is the only thing that writes the result.
 */
export function deriveStudentStatus(
  enrollments: { status: string }[],
): StudentStatus {
  if (enrollments.length === 0) return "PRE_REGISTERED";
  if (enrollments.some((enrolment) => enrolment.status === "ACTIVE")) {
    return "ENROLLED";
  }

  switch (enrollments[0].status) {
    case "TRANSFERRED":
      return "TRANSFERRED";
    case "WITHDRAWN":
      return "WITHDRAWN";
    case "COMPLETED":
      return "GRADUATED";
    // PENDING and anything unrecognised: a file with no place yet.
    default:
      return "PRE_REGISTERED";
  }
}

/**
 * The steps a pupil's file goes through, in order — the "parcours" the profile
 * screen renders as a stepper.
 *
 * Declared here rather than in the component because the same list drives the
 * dashboard's pipeline figures: a school wants to know how many files are stuck
 * at "no family attached" as much as it wants to draw the stepper.
 */
export const STUDENT_WORKFLOW_STEPS = [
  "FILE",
  "FAMILY",
  "ENROLMENT",
  "CLASS",
  "FEES",
  "PAYMENT",
] as const;
export type StudentWorkflowStep = (typeof STUDENT_WORKFLOW_STEPS)[number];

/**
 * Which steps a pupil has completed, from the facts rather than from a stored
 * flag — a status column that can disagree with the rows underneath it is worse
 * than no status column at all.
 */
export function workflowStateOf(input: {
  hasFamily: boolean;
  hasEnrolment: boolean;
  hasClass: boolean;
  hasFees: boolean;
  /**
   * Nothing already due has gone unpaid — see `PaymentStanding.overdueCentimes`
   * in modules/treasury/queries.ts.
   *
   * Deliberately *not* "the year is paid in full". Scolarité is collected in
   * nine or ten instalments, so a family that has never missed one still owes
   * most of the year until June; marking that step incomplete would leave the
   * parcours red for every pupil in the school, all year, and a warning that is
   * always on is a warning nobody reads.
   */
  isUpToDate: boolean;
}): Record<StudentWorkflowStep, boolean> {
  return {
    // The file exists — the pupil is being looked at, so this is always done.
    FILE: true,
    FAMILY: input.hasFamily,
    ENROLMENT: input.hasEnrolment,
    CLASS: input.hasClass,
    FEES: input.hasFees,
    // Nothing to collect yet is not the same as being behind: an échéancier
    // that does not exist cannot be in arrears.
    PAYMENT: input.hasFees && input.isUpToDate,
  };
}

/**
 * The first step not yet done, or null when the parcours is complete.
 *
 * `steps` narrows the list to the ones the viewer may see, so a reader without
 * access to the caisse is never told the next thing to do is chase a payment.
 */
export function nextWorkflowStep(
  state: Record<StudentWorkflowStep, boolean>,
  steps: readonly StudentWorkflowStep[] = STUDENT_WORKFLOW_STEPS,
): StudentWorkflowStep | null {
  return steps.find((step) => !state[step]) ?? null;
}
