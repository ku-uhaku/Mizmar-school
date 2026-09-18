import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthContext } from "@/lib/dal";
import { getDictionaryFor } from "@/lib/i18n/server";
import { rosterToCsv, type RosterFile } from "@/modules/massar/roster-file";

/**
 * What the MASSAR class list needs from the pupil importer: a class that does
 * not exist yet, a birthplace that is not in the school's list, and households
 * guessed from a surname that a secretary can split.
 *
 * The database is a recording proxy, so these are claims about *what would be
 * written* — how many classes, cities and dossiers are opened, and that nothing
 * is opened twice for the second pupil of the same class.
 */

const t = getDictionaryFor("en");

const calls: { model: string; op: string; args: unknown }[] = [];
let answers: Record<string, unknown> = {};

const db: Record<string, unknown> = new Proxy(
  {},
  {
    get: (_target, model: string) => {
      // The transaction runs its callback against the same recording client.
      if (model === "$transaction") return async (run: (tx: unknown) => unknown) => run(db);
      return new Proxy(
        {},
        {
          get: (_d, op: string) => async (args: unknown) => {
            calls.push({ model, op, args });
            const key = `${model}.${op}`;
            if (key in answers) return answers[key];
            return op === "findMany" ? [] : op === "create" ? { id: `${model}-new` } : null;
          },
        },
      );
    },
  },
);

vi.mock("@/lib/db", () => ({ db, auditClient: {} }));
vi.mock("@/lib/school-settings-server", () => ({
  loadSchoolSettings: async () => ({
    studentCodeFormat: "E-{year}-{seq:4}",
    familyCodeFormat: "F-{year}-{seq:4}",
  }),
}));
vi.mock("@/modules/enrolment/service", () => ({ generateFeeSchedule: async () => 0 }));
vi.mock("@/modules/families/service", () => ({ refreshHouseholdAccess: async () => {} }));
vi.mock("@/modules/students/service", () => ({ refreshStudentStatus: async () => {} }));

const { commitImport, planImport } = await import("@/modules/imports/service");

const context = {
  currentSchool: { id: "school-1" },
  currentSchoolYear: { id: "year-1" },
} as unknown as AuthContext;

const OFFERING = {
  id: "offering-1",
  level: { code: "1AP", name: "1ère année", nameAr: "السنة الأولى ابتدائي" },
  track: null,
  classes: [] as { id: string; code: string; name: string | null; massarCode: string | null }[],
};

function csvOf(pupils: [code: string, surname: string, first: string, place?: string][]): string {
  const file: RosterFile = {
    sheetName: "ListEleve",
    schoolLabel: null,
    schoolYearLabel: "2026/2027",
    levelLabel: "الأول ابتدائي عام",
    classLabel: "1APG-1",
    pupils: pupils.map(([massarCode, lastNameAr, firstNameAr, birthPlaceAr], index) => ({
      line: index + 1,
      sheetRow: 11 + index,
      massarCode,
      lastNameAr,
      firstNameAr,
      gender: "ذكر",
      birthDate: "2020-05-31",
      birthPlaceAr: birthPlaceAr ?? "",
    })),
  };
  return rosterToCsv(file);
}

const of = (model: string, op: string) =>
  calls.filter((call) => call.model === model && call.op === op);

beforeEach(() => {
  calls.length = 0;
  answers = { "levelOffering.findMany": [OFFERING] };
});

describe("a class the school has not drawn up yet", () => {
  const csv = csvOf([["B1", "طاهري", "محمد"]]);

  it("is refused by default, naming the classes that do exist", async () => {
    const plan = await planImport(context, csv, t);
    expect(plan.rows[0].outcome).toBe("REJECT");
    expect(plan.rows[0].issues[0].column).toBe("className");
  });

  it("is planned as a class to open when the caller allows it", async () => {
    const plan = await planImport(context, csv, t, { createMissingClasses: true });
    expect(plan.rows[0].outcome).toBe("CREATE");
    expect(plan.rows[0].refs).toMatchObject({
      levelOfferingId: "offering-1",
      classToCreate: "1APG-1",
    });
    expect(plan.rows[0].enrols).toBe(true);
  });

  it("finds a class already mapped to MASSAR's label, whatever the school calls it", async () => {
    answers["levelOffering.findMany"] = [
      { ...OFFERING, classes: [{ id: "class-9", code: "CP-A", name: null, massarCode: "1APG-1" }] },
    ];
    const plan = await planImport(context, csv, t);
    expect(plan.rows[0].outcome).toBe("CREATE");
    expect(plan.rows[0].refs.schoolClassId).toBe("class-9");
    expect(plan.rows[0].refs.classToCreate).toBeUndefined();
  });

  it("names the level it could not find", async () => {
    answers["levelOffering.findMany"] = [];
    const plan = await planImport(context, csv, t, { createMissingClasses: true });
    expect(plan.rows[0].outcome).toBe("REJECT");
    expect(plan.rows[0].issues[0].column).toBe("levelCode");
  });
});

describe("guessing households from a surname", () => {
  const csv = csvOf([
    ["B1", "طاهري", "محمد"],
    ["B2", "طاهري", "سارة"],
    ["B3", "منير", "وئام"],
  ]);
  const options = { createMissingClasses: true };

  it("puts pupils with the same surname in one household", async () => {
    const plan = await planImport(context, csv, t, options);
    expect(plan.rows[0].familyKey).toBe(plan.rows[1].familyKey);
    expect(plan.rows[2].familyKey).not.toBe(plan.rows[0].familyKey);
    expect(plan.counts.newFamilies).toBe(2);
  });

  it("gives a split household one dossier per pupil", async () => {
    const key = "famille طاهري";
    const plan = await planImport(context, csv, t, { ...options, splitFamilies: [key] });
    expect(plan.rows[0].familyKey).not.toBe(plan.rows[1].familyKey);
    expect(plan.rows[0].familyKey.startsWith(`${key}#`)).toBe(true);
    expect(plan.counts.newFamilies).toBe(3);
  });

  it("attaches to a dossier on file, found by its Arabic spelling", async () => {
    answers["family.findMany"] = [{ code: "F-2026-0001", name: "Famille Tahiri", nameAr: "أسرة طاهري" }];
    const plan = await planImport(context, csv, t, options);
    expect(plan.rows[0].existingFamilyCode).toBe("F-2026-0001");
    expect(plan.rows[1].existingFamilyCode).toBe("F-2026-0001");
    expect(plan.counts.newFamilies).toBe(1);
  });

  it("does not attach a split pupil to the dossier on file", async () => {
    answers["family.findMany"] = [{ code: "F-2026-0001", name: "Famille Tahiri", nameAr: "أسرة طاهري" }];
    const plan = await planImport(context, csv, t, { ...options, splitFamilies: ["famille طاهري"] });
    expect(plan.rows[0].existingFamilyCode).toBeUndefined();
  });
});

describe("MASSAR codes already in use", () => {
  const options = { createMissingClasses: true };

  it("skips a pupil whose code is already on the school's books", async () => {
    answers["student.findMany"] = [
      { code: "E-1", massarCode: "B1", firstName: "محمد", lastName: "طاهري" },
    ];
    const plan = await planImport(context, csvOf([["B1", "طاهري", "محمد"]]), t, options);
    expect(plan.rows[0].outcome).toBe("SKIP");
    expect(plan.rows[0].issues[0].column).toBe("massarCode");
  });

  it("skips the second copy of a code listed twice in the file", async () => {
    const plan = await planImport(
      context,
      csvOf([
        ["B1", "طاهري", "محمد"],
        ["B1", "منير", "وئام"],
      ]),
      t,
      options,
    );
    expect(plan.rows.map((row) => row.outcome)).toEqual(["CREATE", "SKIP"]);
  });
});

describe("writing a class list", () => {
  const options = { createMissingClasses: true };
  const csv = csvOf([
    ["B1", "طاهري", "محمد", "وجدة"],
    ["B2", "طاهري", "سارة", "وجدة"],
    ["B3", "منير", "وئام", "فاس"],
  ]);

  it("opens the class once, seats every pupil in it and reports it", async () => {
    answers["schoolClass.create"] = { id: "class-new" };
    const result = await commitImport(context, csv, t, options);

    expect(result).toMatchObject({ created: 3, enrolled: 3, classes: 1 });
    expect(of("schoolClass", "create")).toHaveLength(1);
    expect(of("schoolClass", "create")[0].args).toMatchObject({
      data: { schoolId: "school-1", levelOfferingId: "offering-1", code: "1APG-1", massarCode: "1APG-1" },
    });
    for (const call of of("enrollment", "create")) {
      expect(call.args).toMatchObject({ data: { schoolClassId: "class-new", levelOfferingId: "offering-1" } });
    }
  });

  it("opens each birthplace once and files it on the pupil", async () => {
    answers["city.create"] = { id: "city-new" };
    await commitImport(context, csv, t, options);

    // Two towns for three pupils: the second pupil born in Oujda reuses the first's row.
    expect(of("city", "create")).toHaveLength(2);
    expect(of("student", "create")[0].args).toMatchObject({ data: { birthCityId: "city-new" } });
  });

  it("copies the Arabic spelling into the Latin fields and keeps the code", async () => {
    await commitImport(context, csv, t, options);
    expect(of("student", "create")[0].args).toMatchObject({
      data: {
        schoolId: "school-1",
        massarCode: "B1",
        firstName: "محمد",
        lastName: "طاهري",
        firstNameAr: "محمد",
        lastNameAr: "طاهري",
        gender: "MALE",
      },
    });
  });

  it("opens one household for siblings, and one each once split", async () => {
    await commitImport(context, csv, t, options);
    expect(of("family", "create")).toHaveLength(2);
    expect(of("family", "create")[0].args).toMatchObject({
      data: { name: "Famille طاهري", nameAr: "أسرة طاهري" },
    });

    calls.length = 0;
    await commitImport(context, csv, t, { ...options, splitFamilies: ["famille طاهري"] });
    expect(of("family", "create")).toHaveLength(3);
  });

  it("does not open a class the caller was not allowed to open", async () => {
    const result = await commitImport(context, csv, t, { createMissingClasses: false });
    expect(result.created).toBe(0);
    expect(of("schoolClass", "create")).toHaveLength(0);
    expect(of("student", "create")).toHaveLength(0);
  });

  it("writes nothing for a file whose every pupil is already on file", async () => {
    answers["student.findMany"] = [
      { code: "E-1", massarCode: "B1", firstName: "a", lastName: "b" },
      { code: "E-2", massarCode: "B2", firstName: "a", lastName: "b" },
      { code: "E-3", massarCode: "B3", firstName: "a", lastName: "b" },
    ];
    const result = await commitImport(context, csv, t, options);
    expect(result).toEqual({ created: 0, families: 0, enrolled: 0, classes: 0 });
    expect(of("student", "create")).toHaveLength(0);
  });
});
