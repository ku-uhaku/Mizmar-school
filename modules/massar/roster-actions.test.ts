import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDictionaryFor } from "@/lib/i18n/server";
import { readSheet, readWorkbook } from "@/lib/xlsx";
import { buildWorkbook } from "@/lib/xlsx-build";
import { parseRosterCells } from "@/modules/massar/roster-file";

/**
 * The class-list entry points: who may call them, what they hand the importer,
 * and what an exported class contains.
 *
 * The importer itself is stubbed — `roster-import.test.ts` covers what it writes.
 * What is asserted here is the part that belongs to this module: every creating
 * permission is asked for before a file is read, the school year is checked, and
 * the only decisions taken on the browser's word are the households to split.
 */

const t = getDictionaryFor("en");
const fixture = readFileSync(join(__dirname, "fixtures", "ListEleve_20260918.xlsx"));

const SCHOOL = "school-1";
const granted = new Set<string>();
const asked: string[] = [];
let yearName = "2026/2027";

class ForbiddenError extends Error {
  constructor(readonly permission?: string) {
    super(`Missing permission: ${permission}`);
    this.name = "ForbiddenError";
  }
}

const auth = () => ({
  organization: { id: "org-1" },
  currentSchool: { id: SCHOOL, name: "École Test" },
  currentSchoolYear: { id: "year-1", name: yearName },
  user: { id: "user-1" },
  can: (code: string) => granted.has(code),
});

vi.mock("@/lib/dal", () => ({
  ForbiddenError,
  requireAuth: async () => auth(),
  authorizeSchool: async (_school: string, permission: string) => {
    asked.push(permission);
    if (!granted.has(permission)) throw new ForbiddenError(permission);
    return auth();
  },
}));
vi.mock("@/lib/i18n/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/server")>()),
  getDictionary: async () => t,
}));
vi.mock("@/lib/audit", () => ({ recordEvent: async () => {} }));
vi.mock("next/cache", () => ({ refresh: () => {} }));

const planned: unknown[] = [];
const committed: unknown[] = [];
vi.mock("@/modules/imports/service", () => ({
  planImport: async (_c: unknown, csv: string, _t: unknown, options: unknown) => {
    planned.push({ csv, options });
    return { rows: [], counts: { create: 15, skip: 0, reject: 0, newFamilies: 15, enrol: 15 } };
  },
  commitImport: async (_c: unknown, csv: string, _t: unknown, options: unknown) => {
    committed.push({ csv, options });
    return { created: 15, families: 15, enrolled: 15, classes: 1 };
  },
}));

const calls: { model: string; op: string; args: unknown }[] = [];
let classRow: unknown = null;
vi.mock("@/lib/db", () => ({
  auditClient: {},
  db: new Proxy(
    {},
    {
      get: (_t, model: string) =>
        new Proxy(
          {},
          {
            get: (_d, op: string) => async (args: unknown) => {
              calls.push({ model, op, args });
              return model === "schoolClass" && op === "findFirst" ? classRow : [];
            },
          },
        ),
    },
  ),
}));

const { exportRosterAction, importRosterAction, previewRosterAction } = await import(
  "@/modules/massar/actions"
);
const { exportRoster, readRosterFile, yearMatches } = await import(
  "@/modules/massar/roster-queries"
);

const base64 = fixture.toString("base64");
const CREATING = ["student.create", "family.create", "enrolment.create"];

beforeEach(() => {
  granted.clear();
  asked.length = 0;
  planned.length = 0;
  committed.length = 0;
  calls.length = 0;
  classRow = null;
  yearName = "2026/2027";
});

describe("previewing a class list", () => {
  it("is refused without the permission to create pupils, families and inscriptions", async () => {
    for (const missing of CREATING) {
      granted.clear();
      ["massar.reconcile", ...CREATING.filter((code) => code !== missing)].forEach((c) => granted.add(c));
      await expect(previewRosterAction(base64)).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(planned).toHaveLength(0);
  });

  it("reads the file and reports the plan", async () => {
    ["massar.reconcile", ...CREATING].forEach((c) => granted.add(c));
    const result = await previewRosterAction(base64);

    expect(result).toMatchObject({
      status: "ok",
      file: { classLabel: "1APG-1", schoolYearLabel: "2026/2027", pupilCount: 15 },
      classWillBeCreated: false,
    });
    expect(planned).toHaveLength(1);
  });

  it("refuses a list for another school year, naming both", async () => {
    ["massar.reconcile", ...CREATING].forEach((c) => granted.add(c));
    yearName = "2025-2026";
    const result = await previewRosterAction(base64);
    expect(result).toMatchObject({ status: "error" });
    expect((result as { message: string }).message).toContain("2026/2027");
    expect((result as { message: string }).message).toContain("2025-2026");
    expect(planned).toHaveLength(0);
  });

  it("refuses something that is not a workbook", async () => {
    ["massar.reconcile", ...CREATING].forEach((c) => granted.add(c));
    const result = await previewRosterAction(Buffer.from("not a zip").toString("base64"));
    expect(result).toEqual({ status: "error", message: t.massar.errors.notXlsx });
  });

  it("refuses an empty upload", async () => {
    ["massar.reconcile", ...CREATING].forEach((c) => granted.add(c));
    expect(await previewRosterAction("")).toEqual({
      status: "error",
      message: t.massar.errors.emptyFile,
    });
  });

  it("only lets a class be opened by someone who can configure the school", async () => {
    ["massar.reconcile", ...CREATING].forEach((c) => granted.add(c));
    await previewRosterAction(base64);
    granted.add("configuration.manage");
    await previewRosterAction(base64);

    expect(planned.map((p) => (p as { options: { createMissingClasses: boolean } }).options.createMissingClasses)).toEqual([
      false,
      true,
    ]);
  });

  it("passes on only string keys to split, however many the browser sends", async () => {
    ["massar.reconcile", ...CREATING].forEach((c) => granted.add(c));
    await previewRosterAction(base64, { splitFamilies: ["famille a", 7 as unknown as string] });
    expect((planned[0] as { options: { splitFamilies: string[] } }).options.splitFamilies).toEqual(["famille a"]);
  });
});

describe("importing a class list", () => {
  it("needs MASSAR's import permission on top of the creating ones", async () => {
    ["massar.reconcile", ...CREATING].forEach((c) => granted.add(c));
    const result = await importRosterAction(base64);
    // A refusal is returned as a failure state, and nothing is committed.
    expect(result.status).toBe("error");
    expect(committed).toHaveLength(0);
  });

  it("re-plans from the uploaded bytes and reports what it wrote", async () => {
    ["massar.import", ...CREATING, "configuration.manage"].forEach((c) => granted.add(c));
    const result = await importRosterAction(base64, { splitFamilies: ["famille x"] });

    expect(result.status).toBe("success");
    expect(result.message).toContain("15 pupils imported");
    expect(result.message).toContain("1 class(es) opened");
    expect(committed).toHaveLength(1);
    expect(committed[0]).toMatchObject({
      options: { createMissingClasses: true, splitFamilies: ["famille x"] },
    });
  });

  it("writes nothing when the list is for another year", async () => {
    ["massar.import", ...CREATING].forEach((c) => granted.add(c));
    yearName = "2024/2025";
    const result = await importRosterAction(base64);
    expect(result.status).toBe("error");
    expect(committed).toHaveLength(0);
  });
});

describe("reading and checking the file", () => {
  it("reads the fixture and rejects garbage", () => {
    expect(readRosterFile(fixture)).toMatchObject({ ok: true });
    expect(readRosterFile(Buffer.from("junk"))).toEqual({ ok: false, reason: "NOT_XLSX" });
  });

  it("reports a workbook with no pupil table", () => {
    const empty = buildWorkbook("Sheet", [["a", "b"]]);
    expect(readRosterFile(empty)).toEqual({ ok: false, reason: "NO_HEADER" });
  });

  it("compares the year on its four-digit halves, and forgives a file with none", () => {
    const file = (label: string | null) => ({ schoolYearLabel: label }) as never;
    expect(yearMatches(file("2026/2027"), "2026-2027")).toBe(true);
    expect(yearMatches(file("2026/2027"), "2025-2026")).toBe(false);
    expect(yearMatches(file("2026/2027"), null)).toBe(false);
    expect(yearMatches(file(null), "2025-2026")).toBe(true);
  });
});

describe("exporting a class", () => {
  const student = (massarCode: string | null, lastName: string, ar: [string, string] | null) => ({
    student: {
      massarCode,
      firstName: "Prénom",
      lastName,
      firstNameAr: ar?.[1] ?? null,
      lastNameAr: ar?.[0] ?? null,
      gender: "FEMALE",
      birthDate: new Date("2020-05-14T00:00:00Z"),
      birthCity: { name: "Oujda", nameAr: "وجدة" },
    },
  });

  const row = (enrollments: unknown[]) => ({
    code: "1AP-A",
    massarCode: null,
    levelOffering: { level: { name: "1ère année", nameAr: "السنة الأولى ابتدائي" } },
    enrollments,
  });

  it("is scoped to this school, this year and live enrolments", async () => {
    classRow = row([]);
    await exportRoster(auth() as never, "class-1");
    expect(calls[0].args).toMatchObject({
      where: { id: "class-1", schoolId: SCHOOL, levelOffering: { schoolYearId: "year-1" } },
      select: { enrollments: { where: { status: { in: expect.arrayContaining(["ACTIVE"]) } } } },
    });
  });

  it("finds nothing for a class outside the school or the year", async () => {
    classRow = null;
    expect(await exportRoster(auth() as never, "elsewhere")).toBeNull();
  });

  it("lists pupils by MASSAR code, uncoded ones last, in a file that reads back", async () => {
    classRow = row([
      student(null, "Zeroual", null),
      student("B300", "Bennis", ["بنيس", "ياسمين"]),
      student("B100", "Alami", ["علمي", "سارة"]),
    ]);
    const exported = await exportRoster(auth() as never, "class-1");

    expect(exported).toMatchObject({ count: 3, filename: "ListEleve-1AP-A.xlsx" });
    const workbook = readWorkbook(exported!.file);
    const read = parseRosterCells(readSheet(workbook, workbook.sheets[0].name), "x");
    expect(read.ok).toBe(true);
    if (!read.ok) return;

    expect(read.file.classLabel).toBe("1AP-A");
    expect(read.file.schoolLabel).toBe("École Test");
    // The uncoded pupil has no code to identify a row by, so a re-import — which
    // keys on the code — leaves them out rather than inventing one.
    expect(read.file.pupils.map((pupil) => pupil.massarCode)).toEqual(["B100", "B300"]);
    expect(read.file.pupils[0]).toMatchObject({
      lastNameAr: "علمي",
      gender: "أنثى",
      birthDate: "2020-05-14",
      birthPlaceAr: "وجدة",
    });
  });

  it("uses MASSAR's own label for a class that has been mapped", async () => {
    classRow = { ...row([]), massarCode: "1APG-1" };
    expect((await exportRoster(auth() as never, "class-1"))!.filename).toBe("ListEleve-1APG-1.xlsx");
  });
});

describe("the export action", () => {
  it("needs MASSAR's export permission and the right to view pupils", async () => {
    granted.add("massar.export");
    await expect(exportRosterAction("class-1")).rejects.toBeInstanceOf(ForbiddenError);
    expect(asked).toEqual(["massar.export", "student.view"]);
  });

  it("asks for a class before doing anything", async () => {
    ["massar.export", "student.view"].forEach((c) => granted.add(c));
    expect(await exportRosterAction("")).toEqual({
      status: "error",
      message: t.massar.roster.errNoClass,
    });
  });

  it("answers 'no such class' for an id that is not this school's", async () => {
    ["massar.export", "student.view"].forEach((c) => granted.add(c));
    classRow = null;
    expect(await exportRosterAction("someone-elses")).toEqual({
      status: "error",
      message: t.massar.roster.errNoClass,
    });
  });

  it("hands back the workbook as base64", async () => {
    ["massar.export", "student.view"].forEach((c) => granted.add(c));
    classRow = {
      code: "1AP-A",
      massarCode: null,
      levelOffering: { level: { name: "x", nameAr: null } },
      enrollments: [],
    };
    const result = await exportRosterAction("class-1");
    expect(result).toMatchObject({ status: "ok", filename: "ListEleve-1AP-A.xlsx", count: 0 });
    expect(Buffer.from((result as { fileBase64: string }).fileBase64, "base64").subarray(0, 2).toString()).toBe("PK");
  });
});
