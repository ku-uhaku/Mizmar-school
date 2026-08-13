/**
 * How a niveau is written wherever one is picked.
 *
 * Two rules, and both are about the same thing — a dropdown of levels is
 * unreadable unless it says which cycle each one belongs to:
 *
 *   1. Options are grouped under their cycle. "1AP" and "1AC" are one keystroke
 *      apart and sit six years apart, and a groupe scolaire lists all four
 *      cycles in one list.
 *   2. Both names are shown. The Latin and Arabic names are the school's own
 *      data, typed into the cursus screen — not strings the dictionary could
 *      hold — and Moroccan school paperwork is issued in both, so a secretary
 *      working in Arabic must be able to find the row whatever the interface
 *      language is.
 *
 * Pure data: no `server-only`, no db. Callers are queries building choices and
 * client components rendering them, and both need the same string or the list
 * and the trigger disagree.
 */

/** The columns a level has to carry to be named. */
export type LevelNaming = {
  code: string;
  name: string;
  nameAr?: string | null;
};

/** A filière, when the level is offered as more than one. */
export type TrackNaming = {
  name: string;
  nameAr?: string | null;
};

/** The cycle a level hangs under — `EducationLevel`, as the school named it. */
export type CycleNaming = {
  name: string;
  nameAr?: string | null;
};

/**
 * The two names side by side, or just the one when the school never filled the
 * Arabic in — an empty half and a stray separator would be worse than nothing.
 */
export function bilingual(name: string, nameAr?: string | null): string {
  const arabic = nameAr?.trim();
  return arabic && arabic !== name ? `${name} · ${arabic}` : name;
}

/**
 * A level in a dropdown: "Troisième année primaire · السنة الثالثة ابتدائي
 * (3AP)".
 *
 * The name leads because it is what the reader is choosing between; the code
 * closes in brackets because the school talks in codes, and two cycles can name
 * a level alike.
 */
export function levelChoiceLabel(
  level: LevelNaming,
  track?: TrackNaming | null,
): string {
  return `${levelNameLabel(level, track)} (${level.code})`;
}

/**
 * The same, without the code — for the places that already show the code
 * beside it, such as the badge in the classes table. Repeating it reads as a
 * mistake rather than as emphasis.
 */
export function levelNameLabel(
  level: Omit<LevelNaming, "code">,
  track?: TrackNaming | null,
): string {
  const latin = track ? `${level.name} — ${track.name}` : level.name;
  const arabic = track
    ? joinArabic(level.nameAr, track.nameAr ?? track.name)
    : level.nameAr;

  return bilingual(latin, arabic);
}

/** The heading the levels of one cycle are listed under. */
export function cycleChoiceLabel(cycle: CycleNaming): string {
  return bilingual(cycle.name, cycle.nameAr);
}

/**
 * The filière only joins the Arabic side when the level itself has an Arabic
 * name: "— Sciences Maths" hanging off nothing reads as a broken row.
 */
function joinArabic(
  levelAr: string | null | undefined,
  trackAr: string,
): string | null {
  const level = levelAr?.trim();
  return level ? `${level} — ${trackAr}` : null;
}
