import { parseImportDate } from "@/modules/imports/parse";

/**
 * Reading a MASSAR "NotesCC" export — the mark sheet a school downloads per
 * class, per subject, per contrôle.
 *
 * Pure. It takes the cells someone else read out of the workbook and returns
 * what the file says; it touches no database and decides nothing. `checks.ts`
 * decides whether what it says matches the school.
 *
 * ── Nothing here is addressed by a fixed row number ──────────────────────────
 * The obvious parser hard-codes `C5` for the establishment and `18` for the
 * first pupil, and it works until the ministry adds a line to the header — at
 * which point every class in the country imports its marks one row out, silently
 * and against the wrong children. So every anchor is *found*:
 *
 *   - the metadata row is the row holding the export GUID,
 *   - the scale row is the row of `sgs` markers,
 *   - the marker row is the row holding `#COM#`,
 *   - the pupils start three rows below the marker row,
 *   - every header value is the first non-empty cell to the right of its label.
 *
 * A file that does not carry those anchors is not a NotesCC export, and saying
 * so is much better than reading it anyway.
 *
 * ── The hidden columns are the load-bearing ones ─────────────────────────────
 * MASSAR hides columns B, H, J and the rest, and hides rows 1, 2, 5 and 15. That
 * is where the establishment code, the export GUID, the subject key, the scale
 * and MASSAR's own pupil numbers live. A reader that skipped what the ministry
 * chose not to show would have nothing left to match on.
 */

// ── Arabic text, compared rather than displayed ──────────────────────────────

/**
 * Folds the spellings of the same Arabic word onto one another.
 *
 * The labels in these files are typed by hand somewhere upstream and come back
 * with a stray tatweel, a hamza that is sometimes on the alef and sometimes not,
 * and two spaces where there was one. Matching them literally means the parser
 * works on the file it was written against and no other.
 */
export function normaliseArabic(value: string): string {
  return value
    .replace(/[ً-ٰٟ]/g, "") // harakat
    .replace(/ـ/g, "") // tatweel
    .replace(/[آأإٱ]/g, "ا") // آ أ إ ٱ → ا
    .replace(/ة/g, "ه") // ة → ه
    .replace(/[ى]/g, "ي") // ى → ي
    .replace(/[:؛،.،]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Labels as MASSAR writes them, normalised once at module load. */
const LABELS = {
  academy: normaliseArabic("أكاديمية"),
  direction: normaliseArabic("م.الإقليمية"),
  school: normaliseArabic("مؤسسة"),
  level: normaliseArabic("المستوى"),
  schoolClass: normaliseArabic("القسم"),
  teacher: normaliseArabic("الاستاذ"),
  term: normaliseArabic("الدورة"),
  assessment: normaliseArabic("نقط"),
  subject: normaliseArabic("المادة"),
  schoolYear: normaliseArabic("السنة الدراسية"),
} as const;

/** The dropdown on the absence column — its only non-empty value. */
const EXCUSED = normaliseArabic("مبرر");

// ── Cell addressing ──────────────────────────────────────────────────────────

function columnIndex(letters: string): number {
  let index = 0;
  for (const character of letters) index = index * 26 + (character.charCodeAt(0) - 64);
  return index;
}

function columnLetters(index: number): string {
  let letters = "";
  let remaining = index;
  while (remaining > 0) {
    const remainder = (remaining - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return letters;
}

type Cells = ReadonlyMap<string, string>;

/** Cells grouped by row, each sorted left to right — the shape every scan wants. */
function byRow(cells: Cells): Map<number, { column: number; ref: string; value: string }[]> {
  const rows = new Map<number, { column: number; ref: string; value: string }[]>();
  for (const [ref, value] of cells) {
    const match = /^([A-Z]+)(\d+)$/.exec(ref);
    if (!match) continue;
    const row = Number(match[2]);
    const list = rows.get(row) ?? [];
    list.push({ column: columnIndex(match[1]), ref, value });
    rows.set(row, list);
  }
  for (const list of rows.values()) list.sort((left, right) => left.column - right.column);
  return rows;
}

// ── What a file turns out to be ──────────────────────────────────────────────

export type MassarPupilRow = {
  /** 1-based position in the sheet, for pointing an error at a line. */
  line: number;
  /** The worksheet row, so an error can name the cell a secretary must fix. */
  sheetRow: number;
  /** MASSAR's internal pupil number — the hidden `B` column. */
  massarNumber: string;
  /** The printed code, e.g. `R185066146`. */
  massarCode: string;
  /** As MASSAR spells it, in Arabic. Family name first, as on a class list. */
  fullNameAr: string;
  birthDate: Date | null;
  /** Raw birth date text, kept so a rejected row can show what was in the cell. */
  birthDateRaw: string;
  /** Null when the cell is empty — "not marked" is not "scored zero". */
  score: number | null;
  scoreRaw: string;
  isAbsent: boolean;
  isExcused: boolean;
  /** The appréciation, e.g. "جيد جدا". */
  comment: string | null;
};

export type MassarNotesFile = {
  /** The sheet the marks are on. */
  sheetName: string;

  /** Hidden `C5` — the code établissement, e.g. `53747V`. */
  schoolCode: string | null;
  /** Hidden `E5` — MASSAR's identity for this mark sheet. */
  exportId: string | null;
  /** Hidden `G5` — which semester, 1 or 2. */
  termNumber: number | null;
  /** Hidden `I5` — which contrôle of the term, 1-based. */
  sequence: number | null;
  /** Hidden `K5` / the note column's marker — the subject key, `#0019#` → `0019`. */
  subjectCode: string | null;
  /**
   * Hidden `M5` and `O5`. Carried through and shown, never asserted on.
   *
   * They are plainly identifiers and just as plainly not ones this app can name
   * from a single file — inventing a column for a value whose meaning is a guess
   * is how a schema acquires a field nobody can ever remove.
   */
  unmappedKeys: readonly string[];

  /** The denominator MASSAR expects back, read from the scale row. Usually 20; 10 here. */
  maxScore: number | null;

  academyLabel: string | null;
  directionLabel: string | null;
  schoolLabel: string | null;
  levelLabel: string | null;
  classLabel: string | null;
  teacherLabel: string | null;
  termLabel: string | null;
  assessmentLabel: string | null;
  subjectLabel: string | null;
  /** As written, e.g. `2022/2023`. */
  schoolYearLabel: string | null;

  /** Where the marks go when the file is written back. */
  noteColumn: string;
  absenceColumn: string;
  commentColumn: string | null;

  pupils: readonly MassarPupilRow[];
};

/** Raised when the workbook is not a NotesCC export at all. */
export class NotesFileShapeError extends Error {
  constructor(readonly reason: "NO_SHEET" | "NO_MARKERS" | "NO_PUPILS") {
    super(reason);
    this.name = "NotesFileShapeError";
  }
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A MASSAR pupil code: one letter, then digits. `R185066146`, `J194011366`. */
const PUPIL_CODE = /^[A-Za-z]\d{6,12}$/;
/** A column marker in the hidden marker row: `#0019#`, `#COM#`. */
const MARKER = /^#(.+)#$/;

export function parseNotesFile(sheetName: string, cells: Cells): MassarNotesFile {
  const rows = byRow(cells);
  const at = (ref: string): string | null => cells.get(ref) ?? null;

  // ── The anchors ───────────────────────────────────────────────────────────
  let metaRow: number | null = null;
  let exportId: string | null = null;
  let markerRow: number | null = null;
  let scaleRow: number | null = null;

  for (const [row, entries] of [...rows].sort((left, right) => left[0] - right[0])) {
    for (const entry of entries) {
      if (metaRow === null && GUID.test(entry.value)) {
        metaRow = row;
        exportId = entry.value;
      }
      if (markerRow === null && entry.value === "#COM#") markerRow = row;
    }
    // The scale row is `sgs` repeated across the sheet, with the note column's
    // denominator sitting in it. Two markers is already unmistakable.
    if (scaleRow === null && entries.filter((entry) => entry.value === "sgs").length >= 2) {
      scaleRow = row;
    }
  }

  if (markerRow === null) throw new NotesFileShapeError("NO_MARKERS");

  // ── The mark columns ──────────────────────────────────────────────────────
  // Row 15 tags each column: `#COM#` is the appréciation, any other `#…#` is a
  // subject's mark column. A sheet exported per subject carries exactly one.
  let noteColumn: number | null = null;
  let subjectCode: string | null = null;
  let commentColumn: number | null = null;

  for (const entry of rows.get(markerRow) ?? []) {
    const marker = MARKER.exec(entry.value);
    if (!marker) continue;
    if (marker[1] === "COM") {
      commentColumn ??= entry.column;
    } else if (noteColumn === null) {
      noteColumn = entry.column;
      subjectCode = marker[1];
    }
  }

  if (noteColumn === null) throw new NotesFileShapeError("NO_MARKERS");
  // The absence column is the pair of the mark column — "التغيب" under the same
  // subject heading — and MASSAR always puts it immediately to its right.
  const absenceColumn = noteColumn + 1;

  // ── Header labels ─────────────────────────────────────────────────────────
  // Each label's value is the first non-empty cell to its right: the gap varies
  // with the merges (C→D, G→I, L→O) and counting columns would encode the merge.
  const labelled = new Map<string, string>();
  for (const entries of rows.values()) {
    for (let index = 0; index < entries.length; index += 1) {
      const key = normaliseArabic(entries[index].value);
      const next = entries[index + 1];
      if (next && key !== "") labelled.set(key, next.value);
    }
  }
  const label = (key: string): string | null => labelled.get(key) ?? null;

  // ── The scale ─────────────────────────────────────────────────────────────
  // Everything in the scale row is `sgs` except the mark column, which holds the
  // denominator. 10 in this file, not the 20 a reader would assume.
  const scaleRaw = scaleRow === null ? null : at(`${columnLetters(noteColumn)}${scaleRow}`);
  const maxScore = scaleRaw !== null && /^\d+$/.test(scaleRaw) ? Number(scaleRaw) : null;

  // ── The pupils ────────────────────────────────────────────────────────────
  // Marker row, then the heading, then its sub-heading, then the class.
  const firstPupilRow = markerRow + 3;
  const pupils: MassarPupilRow[] = [];

  for (const [row, entries] of [...rows].sort((left, right) => left[0] - right[0])) {
    if (row < firstPupilRow) continue;
    // The code column is whichever one carries a pupil code; found rather than
    // assumed, for the same reason as everything else here.
    const code = entries.find((entry) => PUPIL_CODE.test(entry.value));
    if (!code) continue;

    const value = (column: number): string | null =>
      cells.get(`${columnLetters(column)}${row}`) ?? null;

    const numberCell = entries.find(
      (entry) => entry.column < code.column && /^\d{4,}$/.test(entry.value),
    );
    // Name and birth date sit to the right of the code, the date being the only
    // one of them that parses as a date.
    const rest = entries.filter((entry) => entry.column > code.column);
    const dateCell = rest.find((entry) => parseImportDate(entry.value) !== null);
    const nameCell = rest.find((entry) => entry !== dateCell && !/^\d/.test(entry.value));

    const scoreRaw = value(noteColumn) ?? "";
    const absenceRaw = value(absenceColumn) ?? "";
    const commentRaw = commentColumn === null ? null : value(commentColumn);

    const score = scoreRaw === "" ? null : Number(scoreRaw.replace(",", "."));
    const isAbsent = absenceRaw !== "";

    pupils.push({
      line: pupils.length + 1,
      sheetRow: row,
      massarNumber: numberCell?.value ?? "",
      massarCode: code.value.toUpperCase(),
      fullNameAr: nameCell?.value ?? "",
      birthDate: dateCell ? parseImportDate(dateCell.value) : null,
      birthDateRaw: dateCell?.value ?? "",
      score: score === null || Number.isNaN(score) ? null : score,
      scoreRaw,
      isAbsent,
      isExcused: isAbsent && normaliseArabic(absenceRaw) === EXCUSED,
      comment: commentRaw === null || commentRaw === "" ? null : commentRaw,
    });
  }

  if (pupils.length === 0) throw new NotesFileShapeError("NO_PUPILS");

  const digits = (value: string | null): number | null =>
    value !== null && /^\d+$/.test(value) ? Number(value) : null;

  // Hidden metadata sits on the GUID's row, two columns apart: C, E, G, I, K…
  const meta = (column: number): string | null =>
    metaRow === null ? null : at(`${columnLetters(column)}${metaRow}`);

  return {
    sheetName,
    schoolCode: meta(3),
    exportId,
    termNumber: digits(meta(7)),
    sequence: digits(meta(9)),
    // Prefer the note column's own marker; `K5` repeats it for the first subject.
    subjectCode: subjectCode ?? MARKER.exec(meta(11) ?? "")?.[1] ?? null,
    unmappedKeys: [meta(13), meta(15)].filter((value): value is string => value !== null),
    maxScore,
    academyLabel: label(LABELS.academy),
    directionLabel: label(LABELS.direction),
    schoolLabel: label(LABELS.school),
    levelLabel: label(LABELS.level),
    classLabel: label(LABELS.schoolClass),
    teacherLabel: label(LABELS.teacher),
    termLabel: label(LABELS.term),
    assessmentLabel: label(LABELS.assessment),
    subjectLabel: label(LABELS.subject),
    schoolYearLabel: label(LABELS.schoolYear),
    noteColumn: columnLetters(noteColumn),
    absenceColumn: columnLetters(absenceColumn),
    commentColumn: commentColumn === null ? null : columnLetters(commentColumn),
    pupils,
  };
}
