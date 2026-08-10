/**
 * How a year is cut into terms.
 *
 * Pure arithmetic, shared by `modules/school-years/seed.ts` and the setup
 * wizard: both have to turn "this year runs from here to here, in two
 * semesters" into dated `Term` rows, and doing it twice would let a wizard-built
 * year and a seeded one disagree about where the mid-year break falls.
 */

/**
 * The semesters, named only — their dates are a split of whatever span the year
 * declares.
 *
 * They used to be written as calendar months, which quietly assumed a September
 * rentrée: a year running March to February came out as an eleven-month first
 * semester and a seventeen-day second. Splitting the span instead is right for
 * any shape of year, and it is the same arithmetic a school does on paper.
 */
export const TERM_NAMES_2 = [
  { number: 1, name: "Semestre 1", nameAr: "الدورة الأولى" },
  { number: 2, name: "Semestre 2", nameAr: "الدورة الثانية" },
];

/** The same year in three, for a school that works in trimestres. */
export const TERM_NAMES_3 = [
  { number: 1, name: "Trimestre 1", nameAr: "الأسدس الأول" },
  { number: 2, name: "Trimestre 2", nameAr: "الأسدس الثاني" },
  { number: 3, name: "Trimestre 3", nameAr: "الأسدس الثالث" },
];

/** The default names for a year cut into `count` terms. */
export function termNamesFor(count: number): { number: number; name: string; nameAr: string }[] {
  return count >= 3 ? TERM_NAMES_3 : TERM_NAMES_2;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * A year cut into `count` equal spans, back to back with no gap and no overlap.
 *
 * The pair (or trio) always covers the year exactly — a mark or an absence dated
 * anywhere in the year falls in precisely one of them, which is what every
 * screen that groups by term relies on. The last span takes the year's own end
 * date rather than a computed one, so rounding cannot leave a day uncovered.
 */
export function termSpans(
  start: Date,
  end: Date,
  count = 2,
): { start: Date; end: Date }[] {
  const totalDays = Math.floor((end.getTime() - start.getTime()) / DAY_MS);
  const spans: { start: Date; end: Date }[] = [];

  let spanStart = start;
  for (let index = 0; index < count; index += 1) {
    const isLast = index === count - 1;
    const spanEnd = isLast
      ? end
      : addDays(start, Math.floor((totalDays * (index + 1)) / count));
    spans.push({ start: spanStart, end: spanEnd });
    spanStart = addDays(spanEnd, 1);
  }

  return spans;
}

/**
 * Which term is running, by today's date.
 *
 * Derived rather than hardcoded so a year reads as one in the middle of its
 * course whenever it is written — the first term used to be pinned ACTIVE,
 * which was only true while the year happened to start in September. A year
 * written before it opens or after it closes falls back to its first term,
 * since a year marked ACTIVE with no live term is a state no screen expects.
 */
export function termStatus(
  yearStatus: string,
  span: { start: Date; end: Date },
  isFirst: boolean,
  now: Date,
): string {
  if (yearStatus !== "ACTIVE") return yearStatus;
  if (now >= span.start && now <= span.end) return "ACTIVE";
  if (now > span.end) return "CLOSED";
  return isFirst ? "ACTIVE" : "PLANNED";
}
