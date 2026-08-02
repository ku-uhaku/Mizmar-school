/**
 * A school's own policies, as the rest of the app reads them.
 *
 * Pure data — no `server-only`, no `db`, no React — because these values are
 * needed on both sides of the boundary: the mark sheet colours a failing score
 * in the browser, the payroll screen shows a daily rate in the browser, and the
 * services that write the same figures run on the server. One shape, one set of
 * defaults, both sides.
 *
 * In `lib/` rather than in a module because eight of them read it — assessments,
 * timetable, hr, enrolment, students, families, treasury and appearance — and
 * `lib/dal.ts` puts it on every AuthContext. A module owning it would make the
 * DAL import that module, which the layering forbids.
 *
 * ── The defaults are the old constants ──────────────────────────────────────
 * Every value in `DEFAULT_SETTINGS` is exactly what was hardcoded before the
 * SchoolSettings table existed. That is deliberate and load-bearing: a school
 * with no settings row, a request with no school in context, and a seed that
 * has not run yet all behave the way the app behaved yesterday. Nothing has to
 * check whether settings are "there".
 */

/** ISO weekday numbers, Monday to Sunday, as `teachingDays` stores them. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/**
 * Currencies offered in the picker. Amounts are stored in the minor unit
 * throughout, so this changes the label and never the arithmetic — which is
 * why a currency without hundredths does not belong on the list.
 */
export const CURRENCY_CODES = ["MAD", "EUR", "USD"] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export type SchoolSettingsValues = {
  gradingMaxScore: number;
  passMarkBps: number;
  teachingDays: string;
  /** Minutes of class a week a teacher may be given — see SchoolSettings. */
  teacherWeeklyMinutes: number;
  /** Minutes of lessons a week a class may be given. */
  classWeeklyMinutes: number;
  currencyCode: string;
  defaultLocale: string;
  defaultAccent: string;
  studentCodeFormat: string;
  familyCodeFormat: string;
  staffCodeFormat: string;
  defaultInstalmentCount: number;
  feeDueDayOfMonth: number;
  /** How long one period rings for. See the note on the column. */
  periodMinutes: number;
  /** `HH:MM` the morning starts at — the half hour a school actually shifts. */
  dayStartsAt: string;
  afternoonStartsAt: string;
  periodsBeforeBreak: number;
  breakMinutes: number;
  morningPeriods: number;
  afternoonPeriods: number;
  payrollWorkingDays: number;
  /** Employee CNSS share, in basis points. See the note on the column. */
  cnssRateBps: number;
  /** Monthly plafond the CNSS is computed on, in centimes. 0 = uncapped. */
  cnssCeilingCentimes: number;
  amoRateBps: number;
  irRateBps: number;
};

/** The values the app used before any of this was configurable. */
export const DEFAULT_SETTINGS: SchoolSettingsValues = {
  gradingMaxScore: 20,
  passMarkBps: 5000,
  teachingDays: "1,2,3,4,5,6",
  teacherWeeklyMinutes: 1320,
  classWeeklyMinutes: 1800,
  currencyCode: "MAD",
  defaultLocale: "fr",
  defaultAccent: "blue",
  studentCodeFormat: "E-{year}-{seq:4}",
  familyCodeFormat: "F-{year}-{seq:4}",
  staffCodeFormat: "P-{year}-{seq:4}",
  defaultInstalmentCount: 9,
  feeDueDayOfMonth: 5,
  periodMinutes: 60,
  dayStartsAt: "08:00",
  afternoonStartsAt: "14:00",
  periodsBeforeBreak: 2,
  breakMinutes: 15,
  morningPeriods: 4,
  afternoonPeriods: 4,
  payrollWorkingDays: 26,
  // The ordinary Moroccan employee shares. IR stays blank on purpose — a flat
  // rate would be wrong for everybody, and the barème is progressive.
  cnssRateBps: 448,
  cnssCeilingCentimes: 600000,
  amoRateBps: 226,
  irRateBps: 0,
};

/**
 * Fills in whatever a partial row is missing.
 *
 * Takes `null` on purpose: `context.settings` is built from a school that may
 * have no row yet, and every caller would otherwise write the same `?? {}`.
 */
export function settingsOf(
  row: Partial<SchoolSettingsValues> | null | undefined,
): SchoolSettingsValues {
  if (!row) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...stripNullish(row) };
}

function stripNullish(
  row: Partial<SchoolSettingsValues>,
): Partial<SchoolSettingsValues> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value !== null && value !== undefined) out[key] = value;
  }
  return out as Partial<SchoolSettingsValues>;
}

// ── Notation ────────────────────────────────────────────────────────────────

/**
 * The score at or above which a paper is passed, on this school's scale.
 *
 * Rounded to two decimals rather than left as a float: it is shown to teachers
 * ("pass mark: 10") and comparing against 9.999999 would fail a mark of 10.
 */
export function passMarkOf(settings: SchoolSettingsValues): number {
  return (
    Math.round(((settings.gradingMaxScore * settings.passMarkBps) / 10_000) * 100) /
    100
  );
}

/**
 * Whether a mark passes, on a paper marked out of `maxScore`.
 *
 * `maxScore` is the paper's own, not the school's: a school may mark out of 20
 * and still set one paper out of 40, and a mark must be judged against the
 * paper it was earned on. The school setting supplies the *ratio*.
 */
export function isPassingScore(
  score: number,
  maxScore: number,
  settings: SchoolSettingsValues,
): boolean {
  return maxScore > 0 && (score / maxScore) * 10_000 >= settings.passMarkBps;
}

// ── Calendrier ──────────────────────────────────────────────────────────────

/**
 * The teaching week, as sorted, de-duplicated ISO weekday numbers.
 *
 * Anything outside 1–7 is dropped, and an empty result falls back to the
 * default week: a settings row edited by hand must not be able to leave the
 * timetable with no columns at all.
 */
export function parseTeachingDays(value: string): Weekday[] {
  const days = [
    ...new Set(
      value
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((day): day is Weekday =>
          Number.isInteger(day) && day >= 1 && day <= 7,
        ),
    ),
  ].sort((a, b) => a - b);

  return days.length > 0 ? days : [1, 2, 3, 4, 5, 6];
}

export function teachingDaysOf(settings: SchoolSettingsValues): Weekday[] {
  return parseTeachingDays(settings.teachingDays);
}

export function isTeachingDayIn(
  day: number,
  settings: SchoolSettingsValues,
): boolean {
  return teachingDaysOf(settings).includes(day as Weekday);
}

// ── Matricules ──────────────────────────────────────────────────────────────

/**
 * Renders a code template: `"E-{year}-{seq:4}"` → `"E-2025-0431"`.
 *
 * Supported placeholders, and nothing else — every other character is copied
 * through, so a school writing "2025/0431" just writes that:
 *
 *   {year}    four-digit year          2025
 *   {yy}      two-digit year           25
 *   {seq}     the sequence, unpadded    431
 *   {seq:N}   zero-padded to N digits   0431
 *
 * Padding is capped at 12 so a hand-typed `{seq:9999}` cannot produce a
 * megabyte-long code.
 */
export function formatEntityCode(
  format: string,
  year: number,
  sequence: number,
): string {
  return format
    .replace(/\{year\}/g, String(year))
    .replace(/\{yy\}/g, String(year % 100).padStart(2, "0"))
    .replace(/\{seq:(\d{1,2})\}/g, (_match, width: string) =>
      String(sequence).padStart(Math.min(Number(width), 12), "0"),
    )
    .replace(/\{seq\}/g, String(sequence));
}

/**
 * Whether a template can actually produce distinct codes.
 *
 * A format with no `{seq}` gives every pupil in a year the same matricule,
 * which the unique index would then reject one row at a time — better to
 * refuse the setting than to break enrolment. Used by the settings validator.
 */
export function codeFormatHasSequence(format: string): boolean {
  return /\{seq(:\d{1,2})?\}/.test(format);
}

const SEQUENCE_PLACEHOLDER = /\{seq(?::\d{1,2})?\}/;

/**
 * Everything a rendered code has *before* its sequence — "E-2025-".
 *
 * This is what the allocators scan on (`code: { startsWith: prefix }`), which
 * is why it has to come from the format rather than from slicing a fixed number
 * of characters off the end: a school numbering "2025/431" has a three-
 * character prefix and no padding at all.
 */
export function codePrefixOf(format: string, year: number): string {
  const rendered = format
    .replace(/\{year\}/g, String(year))
    .replace(/\{yy\}/g, String(year % 100).padStart(2, "0"));

  const at = rendered.search(SEQUENCE_PLACEHOLDER);
  return at === -1 ? rendered : rendered.slice(0, at);
}

/**
 * Reads the sequence back out of a code this format produced, or null when the
 * code does not match — a row written under last year's format, or by hand.
 *
 * Returning null rather than 0 matters: the allocator takes the highest
 * sequence it can *recognise*, so codes in an older format are skipped instead
 * of being read as zero and handing the next pupil a number already in use.
 */
export function sequenceFromCode(
  format: string,
  year: number,
  code: string,
): number | null {
  const rendered = format
    .replace(/\{year\}/g, String(year))
    .replace(/\{yy\}/g, String(year % 100).padStart(2, "0"));

  // Escape everything that is not the placeholder, so a format containing "."
  // or "+" cannot turn into a wildcard.
  const pattern = rendered
    .split(SEQUENCE_PLACEHOLDER)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("(\\d+)");

  const match = new RegExp(`^${pattern}$`).exec(code);
  if (!match?.[1]) return null;

  const sequence = Number(match[1]);
  return Number.isSafeInteger(sequence) ? sequence : null;
}

// ── Paie ────────────────────────────────────────────────────────────────────

/** What one day of a monthly salary is worth, on this school's convention. */
export function dailyRateOf(
  monthlySalaryCentimes: number,
  settings: SchoolSettingsValues,
): number {
  const days = Math.max(1, settings.payrollWorkingDays);
  return Math.round(monthlySalaryCentimes / days);
}

// ── Facturation ─────────────────────────────────────────────────────────────

/**
 * The due day, clamped into a range every month actually has.
 *
 * 28 rather than 31: a schedule whose February line silently moves to March 3rd
 * is a schedule an accountant cannot reconcile.
 */
export function dueDayOf(settings: SchoolSettingsValues): number {
  return Math.min(28, Math.max(1, settings.feeDueDayOfMonth));
}
