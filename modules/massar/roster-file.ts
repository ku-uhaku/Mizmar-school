import { toCsv } from "@/lib/csv";
import { normaliseArabic } from "@/modules/massar/notes-file";

/**
 * Reading a MASSAR "ListEleve" export — the class list a school downloads per
 * class, and the file it hands back when a class is exported from here.
 *
 * Pure: it takes the cells someone else read out of the workbook and returns what
 * the file says. It decides nothing about the school — `rosterToCsv` only
 * rewrites the file into the shape the pupil importer already understands, so
 * every check that importer makes (duplicate codes, existing households, the
 * price list) applies to a MASSAR list exactly as it does to a school's own.
 *
 * ── Nothing is addressed by a fixed row number ───────────────────────────────
 * Same rule as `notes-file.ts`: the table starts under the row that holds the
 * `الرمز` header, and its columns are the ones that header names. A ministry
 * that adds a line above the table, or reorders two columns, does not import
 * every class one row out.
 *
 * ── What this file does not carry ────────────────────────────────────────────
 * A class list has no parents, no address and no Latin spelling of the names.
 * The Arabic spelling is copied into the Latin fields (the school's choice —
 * `Student.firstName` is required and a guess at a transliteration would be a
 * wrong name printed on a certificate), and the household can only be guessed
 * from the surname.
 */

export type RosterPupil = {
  /** 1-based position among the pupils, for pointing an error at a line. */
  line: number;
  /** The worksheet row. */
  sheetRow: number;
  massarCode: string;
  lastNameAr: string;
  firstNameAr: string;
  gender: string;
  birthDate: string;
  birthPlaceAr: string;
};

export type RosterFile = {
  sheetName: string;
  schoolLabel: string | null;
  schoolYearLabel: string | null;
  levelLabel: string | null;
  classLabel: string | null;
  pupils: RosterPupil[];
};

export type RosterFileRead =
  | { ok: true; file: RosterFile }
  | { ok: false; reason: "NO_HEADER" | "NO_PUPILS" };

const LABELS = {
  school: normaliseArabic("المؤسسة"),
  level: normaliseArabic("المستوى"),
  schoolClass: normaliseArabic("القسم"),
  schoolYear: normaliseArabic("السنة الدراسية"),
} as const;

/** The table's column headers, as MASSAR spells them. */
const COLUMNS = {
  massarCode: normaliseArabic("الرمز"),
  lastNameAr: normaliseArabic("النسب"),
  firstNameAr: normaliseArabic("الإسم"),
  gender: normaliseArabic("النوع"),
  birthDate: normaliseArabic("تاريخ الإزدياد"),
  birthPlaceAr: normaliseArabic("مكان الازدياد"),
} as const;

type Cell = { column: number; ref: string; value: string };

function columnIndex(letters: string): number {
  let index = 0;
  for (const character of letters) index = index * 26 + (character.charCodeAt(0) - 64);
  return index;
}

function byRow(cells: ReadonlyMap<string, string>): Map<number, Cell[]> {
  const rows = new Map<number, Cell[]>();
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

/** The value of a header field: the first non-empty cell right of its label. */
function labelled(rows: Map<number, Cell[]>, label: string, before: number): string | null {
  for (const [rowIndex, cells] of rows) {
    if (rowIndex >= before) continue;
    for (let i = 0; i < cells.length; i += 1) {
      if (normaliseArabic(cells[i].value) !== label) continue;
      const value = cells[i + 1]?.value?.trim();
      if (value) return value;
    }
  }
  return null;
}

/**
 * An Excel date cell arrives as a serial number when the file was saved through
 * some converters, and as `YYYY-MM-DD` text when MASSAR wrote it. Both become the
 * ISO form the importer's date parser reads.
 */
function isoDate(raw: string): string {
  const value = raw.trim();
  if (/^\d{4,6}$/.test(value)) {
    const serial = Number(value);
    if (serial >= 10_000 && serial <= 60_000) {
      return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000).toISOString().slice(0, 10);
    }
  }
  return value;
}

export function parseRosterCells(
  cells: ReadonlyMap<string, string>,
  sheetName: string,
): RosterFileRead {
  const rows = byRow(cells);

  let headerRow: number | null = null;
  let columns: Partial<Record<keyof typeof COLUMNS, number>> = {};

  for (const [rowIndex, rowCells] of rows) {
    const found: Partial<Record<keyof typeof COLUMNS, number>> = {};
    for (const cell of rowCells) {
      const text = normaliseArabic(cell.value);
      for (const key of Object.keys(COLUMNS) as (keyof typeof COLUMNS)[]) {
        if (text === COLUMNS[key] && found[key] === undefined) found[key] = cell.column;
      }
    }
    // The code, both name halves and the birth date are what a pupil is; a row
    // holding fewer is a title or a legend, not the table.
    if (
      found.massarCode !== undefined &&
      found.lastNameAr !== undefined &&
      found.firstNameAr !== undefined &&
      found.birthDate !== undefined &&
      (headerRow === null || rowIndex < headerRow)
    ) {
      headerRow = rowIndex;
      columns = found;
    }
  }

  if (headerRow === null) return { ok: false, reason: "NO_HEADER" };

  const pupils: RosterPupil[] = [];
  const sortedRows = [...rows.keys()].filter((index) => index > headerRow!).sort((a, b) => a - b);

  for (const rowIndex of sortedRows) {
    const at = (key: keyof typeof COLUMNS): string => {
      const column = columns[key];
      if (column === undefined) return "";
      return rows.get(rowIndex)?.find((cell) => cell.column === column)?.value.trim() ?? "";
    };

    const massarCode = at("massarCode").toUpperCase();
    // The rank column is not what makes a row a pupil — the code is. A footer
    // ("printed on …") has no code and ends the list.
    if (massarCode === "") continue;

    pupils.push({
      line: pupils.length + 1,
      sheetRow: rowIndex,
      massarCode,
      lastNameAr: at("lastNameAr"),
      firstNameAr: at("firstNameAr"),
      gender: at("gender"),
      birthDate: isoDate(at("birthDate")),
      birthPlaceAr: at("birthPlaceAr"),
    });
  }

  if (pupils.length === 0) return { ok: false, reason: "NO_PUPILS" };

  return {
    ok: true,
    file: {
      sheetName,
      schoolLabel: labelled(rows, LABELS.school, headerRow),
      schoolYearLabel: labelled(rows, LABELS.schoolYear, headerRow),
      levelLabel: labelled(rows, LABELS.level, headerRow),
      classLabel: labelled(rows, LABELS.schoolClass, headerRow),
      pupils,
    },
  };
}

/**
 * The level a class label points at: `1APG-1` → `1AP`, `2ACG-3` → `2AC`.
 *
 * MASSAR's Arabic level name ("الأول ابتدائي عام") is not what a school keeps in
 * `Level.nameAr`, and the class label is — the digit and the cycle letters lead
 * it, then the stream letter, then the section. Null when the label does not
 * follow that shape, in which case the file's own level text is tried instead.
 */
export function deriveLevelCode(classLabel: string | null): string | null {
  if (!classLabel) return null;
  const match = /^(\d+[A-Z]+?)G?-.+$/i.exec(classLabel.trim());
  return match ? match[1].toUpperCase() : null;
}

/** The school year as `2026/2027`, from however the file or the app writes it. */
export function yearDigits(label: string | null): string {
  return label?.match(/\d{4}/g)?.slice(0, 2).join("/") ?? "";
}

/**
 * The file, rewritten as the pupil importer's CSV.
 *
 * Header cells are the importer's own column keys, which `matchHeaders` accepts
 * in any language. `familyName` is the Arabic surname: that is the only household
 * signal the file carries, and the importer groups and matches on it, so two
 * pupils sharing a surname land in one dossier — which the preview shows so a
 * secretary can split a guess that grouped strangers.
 */
export function rosterToCsv(file: RosterFile): string {
  const levelCode = deriveLevelCode(file.classLabel) ?? file.levelLabel ?? "";

  const header = [
    "massarCode",
    "lastName",
    "firstName",
    "lastNameAr",
    "firstNameAr",
    "gender",
    "birthDate",
    "birthCity",
    "familyName",
    "levelCode",
    "className",
  ];

  const body = file.pupils.map((pupil) => [
    pupil.massarCode,
    pupil.lastNameAr,
    pupil.firstNameAr,
    pupil.lastNameAr,
    pupil.firstNameAr,
    pupil.gender,
    pupil.birthDate,
    pupil.birthPlaceAr,
    pupil.lastNameAr,
    levelCode,
    file.classLabel ?? "",
  ]);

  return toCsv([header, ...body]);
}

export type RosterSheetInput = {
  schoolName: string;
  yearName: string;
  levelName: string;
  classLabel: string;
  pupils: readonly {
    massarCode: string | null;
    lastName: string;
    firstName: string;
    lastNameAr: string | null;
    firstNameAr: string | null;
    gender: string;
    birthDate: Date;
    birthPlace: string | null;
  }[];
};

/**
 * The rows of a ListEleve sheet, laid out as MASSAR lays them out: the title, a
 * small header block of label/value pairs, then the table under its headings.
 *
 * Written so that `parseRosterCells` reads it straight back — importing the
 * file this produces must say "nothing new", which is the test that the two
 * directions agree.
 */
export function rosterSheetRows(input: RosterSheetInput): (string | number | null)[][] {
  const rows: (string | number | null)[][] = [];
  const put = (row: number, column: number, value: string | number | null) => {
    while (rows.length < row) rows.push([]);
    const cells = rows[row - 1];
    while (cells.length < column) cells.push(null);
    cells[column - 1] = value;
  };

  put(2, 3, "لائحة التلاميذ");
  put(6, 6, "المؤسسة:");
  put(6, 7, input.schoolName);
  put(7, 1, ": المستوى");
  put(7, 3, input.levelName);
  put(7, 6, "السنة الدراسية:");
  put(7, 7, input.yearName);
  put(8, 1, ": القسم");
  put(8, 3, input.classLabel);

  ["ر.ت", "الرمز", "النسب", "الإسم", "النوع", "تاريخ الإزدياد", "مكان الازدياد"].forEach(
    (heading, index) => put(10, index + 1, heading),
  );

  input.pupils.forEach((pupil, index) => {
    const row = 11 + index;
    put(row, 1, index + 1);
    put(row, 2, pupil.massarCode);
    // Arabic where the school holds it — that is the spelling MASSAR prints — and
    // the Latin one otherwise, so no row leaves the school with a blank name.
    put(row, 3, pupil.lastNameAr ?? pupil.lastName);
    put(row, 4, pupil.firstNameAr ?? pupil.firstName);
    put(row, 5, pupil.gender === "FEMALE" ? "أنثى" : "ذكر");
    put(row, 6, pupil.birthDate.toISOString().slice(0, 10));
    put(row, 7, pupil.birthPlace);
  });

  return rows;
}
