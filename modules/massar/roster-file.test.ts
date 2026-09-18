import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseCsv } from "@/lib/csv";
import { readSheet, readWorkbook } from "@/lib/xlsx";
import { buildWorkbook } from "@/lib/xlsx-build";
import {
  deriveLevelCode,
  parseRosterCells,
  rosterSheetRows,
  rosterToCsv,
  yearDigits,
  type RosterFile,
} from "@/modules/massar/roster-file";

/**
 * The ListEleve class list — read from the real file MASSAR produced, and round
 * tripped through the workbook this app writes.
 *
 * The fixture is a class of fifteen with no parents, no address and no Latin
 * spelling, which is the whole shape of the problem: everything the importer
 * needs beyond the child has to be derived from it or left blank.
 */

const fixture = readFileSync(join(__dirname, "fixtures", "ListEleve_20260918.xlsx"));

function readFile(buffer: Buffer): RosterFile {
  const workbook = readWorkbook(buffer);
  const sheet = workbook.sheets.find((candidate) => !candidate.hidden)!;
  const result = parseRosterCells(readSheet(workbook, sheet.name), sheet.name);
  if (!result.ok) throw new Error(`Not readable: ${result.reason}`);
  return result.file;
}

describe("reading a MASSAR class list", () => {
  const file = readFile(fixture);

  it("finds the class, the level and the year by their labels, not their cells", () => {
    expect(file.classLabel).toBe("1APG-1");
    expect(file.levelLabel).toBe("الأول ابتدائي عام");
    expect(file.schoolYearLabel).toBe("2026/2027");
    expect(file.schoolLabel).toBe("مجموعة مدارس باب الريان");
  });

  it("reads every pupil, with the code as the thing that makes a row a pupil", () => {
    expect(file.pupils).toHaveLength(15);
    expect(new Set(file.pupils.map((pupil) => pupil.massarCode)).size).toBe(15);
    expect(file.pupils[0]).toMatchObject({
      massarCode: "B236050524",
      lastNameAr: "طاهري",
      firstNameAr: "محمد",
      gender: "ذكر",
      birthDate: "2020-05-31",
      birthPlaceAr: "وجدة",
      sheetRow: 11,
    });
  });

  it("refuses a workbook that has no pupil table", () => {
    const empty = readWorkbook(buildWorkbook("x", [["nothing", "here"]]));
    expect(parseRosterCells(readSheet(empty, "x"), "x")).toEqual({ ok: false, reason: "NO_HEADER" });
  });
});

describe("the level a class label points at", () => {
  it("drops the stream letter and the section", () => {
    expect(deriveLevelCode("1APG-1")).toBe("1AP");
    expect(deriveLevelCode("2ACG-3")).toBe("2AC");
    expect(deriveLevelCode("1AP-A")).toBe("1AP");
  });

  it("returns null when the label is not in that shape", () => {
    expect(deriveLevelCode(null)).toBeNull();
    expect(deriveLevelCode("Salle bleue")).toBeNull();
  });

  it("compares school years on their four-digit halves", () => {
    expect(yearDigits("2026/2027")).toBe("2026/2027");
    expect(yearDigits("Année 2026-2027")).toBe("2026/2027");
    expect(yearDigits(null)).toBe("");
  });
});

describe("the class list as the pupil importer's file", () => {
  const file = readFile(fixture);
  const [header, ...rows] = parseCsv(rosterToCsv(file));

  it("uses the Arabic spelling for both alphabets and the surname for the household", () => {
    const at = (name: string, row = 0) => rows[row][header.indexOf(name)];
    expect(rows).toHaveLength(15);
    expect(at("lastName")).toBe("طاهري");
    expect(at("lastNameAr")).toBe("طاهري");
    expect(at("firstName")).toBe("محمد");
    expect(at("familyName")).toBe("طاهري");
    expect(at("massarCode")).toBe("B236050524");
    expect(at("birthCity")).toBe("وجدة");
  });

  it("seats the pupils in the level the class label names", () => {
    const at = (name: string) => rows[0][header.indexOf(name)];
    expect(at("levelCode")).toBe("1AP");
    expect(at("className")).toBe("1APG-1");
  });
});

describe("exporting a class and reading it back", () => {
  const pupils = [
    {
      massarCode: "B240038242",
      lastName: "Mounir",
      firstName: "Wiam",
      lastNameAr: "منير",
      firstNameAr: "وئام",
      gender: "FEMALE",
      birthDate: new Date("2020-05-14T00:00:00Z"),
      birthPlace: "وجدة",
    },
    {
      massarCode: "B236050524",
      lastName: "Tahiri",
      firstName: "Mohamed",
      lastNameAr: null,
      firstNameAr: null,
      gender: "MALE",
      birthDate: new Date("2020-05-31T00:00:00Z"),
      birthPlace: null,
    },
  ];

  const written = buildWorkbook(
    "ListEleve",
    rosterSheetRows({
      schoolName: "École Test",
      yearName: "2026-2027",
      levelName: "السنة الأولى ابتدائي",
      classLabel: "1AP-A",
      pupils,
    }),
    { rightToLeft: true },
  );
  const back = readFile(written);

  it("reads back the header block and every pupil, so the two directions agree", () => {
    expect(back.classLabel).toBe("1AP-A");
    expect(back.schoolYearLabel).toBe("2026-2027");
    expect(back.pupils.map((pupil) => pupil.massarCode)).toEqual(["B240038242", "B236050524"]);
    expect(back.pupils[0]).toMatchObject({
      lastNameAr: "منير",
      firstNameAr: "وئام",
      gender: "أنثى",
      birthDate: "2020-05-14",
      birthPlaceAr: "وجدة",
    });
  });

  it("falls back to the Latin spelling rather than leaving a name blank", () => {
    expect(back.pupils[1]).toMatchObject({ lastNameAr: "Tahiri", firstNameAr: "Mohamed" });
    expect(back.pupils[1].birthPlaceAr).toBe("");
  });

  it("derives the same level from its own class label", () => {
    expect(deriveLevelCode(back.classLabel)).toBe("1AP");
  });
});
