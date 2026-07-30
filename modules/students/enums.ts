/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/students/*.prisma`. Labels live in `i18n/*.ts` under
 * `studentOptions`.
 */

export const GENDERS = ["MALE", "FEMALE"] as const;
export type Gender = (typeof GENDERS)[number];

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

/** Matricules look like `E-2025-0431`. */
export const STUDENT_CODE_PREFIX = "E";

/** See `nextFamilyCode` — same reasoning, same shape. */
export function nextStudentCode(year: number, sequence: number): string {
  return `${STUDENT_CODE_PREFIX}-${year}-${String(sequence).padStart(4, "0")}`;
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
}): Record<StudentWorkflowStep, boolean> {
  return {
    // The file exists — the pupil is being looked at, so this is always done.
    FILE: true,
    FAMILY: input.hasFamily,
    ENROLMENT: input.hasEnrolment,
    CLASS: input.hasClass,
    FEES: input.hasFees,
  };
}

/** The first step not yet done, or null when the parcours is complete. */
export function nextWorkflowStep(
  state: Record<StudentWorkflowStep, boolean>,
): StudentWorkflowStep | null {
  return STUDENT_WORKFLOW_STEPS.find((step) => !state[step]) ?? null;
}
