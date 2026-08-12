import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/permissions";
import { getDictionaryFor } from "@/lib/i18n/server";
import { SCHOOL_LEVELS } from "@/modules/schools/enums";
import { schoolSchema } from "@/modules/schools/validation";

/**
 * L'école — the row thirty-one tables hang off.
 *
 * Every table in the schema that names a school cascades from it, so this is
 * the widest delete in the app by a distance: pupils, families, staff,
 * payslips, receipts, cheques, marks, registers, the timetable and the buses
 * all go together. That shapes the module twice over.
 *
 * **Creating one is organisation-wide, editing one is not.** A school-scoped
 * role never grants `school.create` — there is no school to scope it to yet —
 * while a director editing their own school is exactly what `authorizeSchool`
 * is for.
 *
 * **Removing one is a last resort.** A school entered in error has nobody on
 * its books and still deletes; one that taught anybody is deactivated, which is
 * what `isActive` is on the form for.
 */

const t = getDictionaryFor("en");

// ─────────────────────────────────────────────────────────────────────────────

const calls: { model: string; op: string; args: unknown }[] = [];
let answers: Record<string, unknown> = {};
/** What the school has on its books, for the three counts the delete guard takes. */
let pupilCount = 0;
let staffCount = 0;
let cashCount = 0;

const db = new Proxy(
  {},
  {
    get: (_target, model: string) =>
      new Proxy(
        {},
        {
          get: (_d, op: string) => async (args: unknown) => {
            calls.push({ model, op, args });
            if (op === "count") {
              if (model === "student") return pupilCount;
              if (model === "staff") return staffCount;
              if (model === "cashOperation") return cashCount;
            }
            const key = `${model}.${op}`;
            if (key in answers) return answers[key];
            return op === "findFirst" || op === "findUnique"
              ? null
              : op === "deleteMany" || op === "updateMany"
                ? { count: 1 }
                : { id: "school-new" };
          },
        },
      ),
  },
);

vi.mock("@/lib/db", () => ({ db, auditClient: {} }));
vi.mock("@/lib/audit", () => ({ recordEvent: async () => {} }));

const granted = new Set<string>();
const asked: string[] = [];
/** Schools the caller may act in, for `authorizeSchool`. */
let reachable = ["school-1"];

class ForbiddenError extends Error {
  readonly permission?: string;
  constructor(permission?: string) {
    super("Forbidden");
    this.permission = permission;
    this.name = "ForbiddenError";
  }
}

const ORG = { id: "org-1" };

vi.mock("@/lib/dal", () => ({
  ForbiddenError,
  authorizeOrg: async (permission: string) => {
    asked.push(`org:${permission}`);
    if (!granted.has(permission)) throw new ForbiddenError(permission);
    return { organization: ORG };
  },
  authorizeSchool: async (schoolId: string, permission: string) => {
    asked.push(`school:${permission}`);
    // Visibility and the code, as the real one does.
    if (!reachable.includes(schoolId) || !granted.has(permission)) {
      throw new ForbiddenError(permission);
    }
    return { organization: ORG, currentSchool: { id: schoolId } };
  },
}));

vi.mock("@/lib/i18n/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/server")>()),
  getDictionary: async () => t,
}));

vi.mock("next/cache", () => ({ refresh: () => {} }));

const { createSchoolAction, deleteSchoolAction, updateSchoolAction } =
  await import("@/modules/schools/actions");

const of = (model: string, op: string) =>
  calls.filter((call) => call.model === model && call.op === op);

const only = (model: string, op: string) => {
  const matches = of(model, op);
  expect(matches, `${model}.${op}`).toHaveLength(1);
  return matches[0]!;
};

const IDLE = { status: "idle" } as never;

function schoolForm(extra: Record<string, string> = {}) {
  const form = new FormData();
  form.set("id", "school-1");
  form.set("code", "als");
  form.set("name", "Al Massira");
  form.set("massarCode", "");
  form.set("level", "GROUP");
  form.set("country", "ma");
  form.set("isActive", "on");
  for (const [key, value] of Object.entries(extra)) form.set(key, value);
  return form;
}

beforeEach(() => {
  calls.length = 0;
  answers = {};
  pupilCount = 0;
  staffCount = 0;
  cashCount = 0;
  asked.length = 0;
  reachable = ["school-1"];
  granted.clear();
  for (const code of Object.values(PERMISSIONS)) granted.add(code);
});

// ── Deleting ─────────────────────────────────────────────────────────────────

describe("deleteSchoolAction", () => {
  it("refuses a school that has pupils on its books", async () => {
    // The bug this closes. Thirty-one tables cascade from School, so one button
    // took the families, the staff, the payslips, the receipts, the marks, the
    // registers, the timetable and the buses with it — and left the activity
    // trail describing rows that no longer exist.
    pupilCount = 412;

    const state = await deleteSchoolAction("school-1");
    expect(state.status).toBe("error");
    expect(state.message).toContain("412");
    expect(of("school", "deleteMany")).toEqual([]);
  });

  it("refuses a school that employs anybody, even with nobody enrolled", async () => {
    // September, or a school created and then abandoned after the setup wizard:
    // nobody on the books yet, but the staff are hired and a payroll may have
    // run. Pupils alone let that through, and the payslips went with it.
    staffCount = 37;

    const state = await deleteSchoolAction("school-1");
    expect(state.status).toBe("error");
    expect(state.message).toContain("37");
    expect(of("school", "deleteMany")).toEqual([]);
  });

  it("refuses a school whose caisse has moved money", async () => {
    cashCount = 8;

    const state = await deleteSchoolAction("school-1");
    expect(state.status).toBe("error");
    expect(state.message).toContain("8");
    expect(of("school", "deleteMany")).toEqual([]);
  });

  it("counts within the caller's own tenant, not by bare id", async () => {
    // `authorizeOrg` validates a *code*, not the id in the request. Without the
    // organisation on each count, an id from another tenant came back "this
    // school has 412 pupils" — a figure about a school the caller may not even
    // name — where the deleteMany below correctly answers "not found".
    await deleteSchoolAction("school-1");

    for (const model of ["student", "staff", "cashOperation"]) {
      expect(only(model, "count").args, model).toMatchObject({
        where: { schoolId: "school-1", school: { organizationId: "org-1" } },
      });
    }
  });

  it("still deletes a school entered in error", async () => {
    // Nobody has ever been enrolled in it. That is the case the button is for.
    const state = await deleteSchoolAction("school-1");
    expect(state.status).toBe("success");
    expect(only("school", "deleteMany").args).toMatchObject({
      where: { id: "school-1", organizationId: "org-1" },
    });
  });

  it("is organisation-wide, not something a director may do to their own", async () => {
    // Closing a school spans schools by definition.
    await deleteSchoolAction("school-1");
    expect(asked).toEqual([`org:${PERMISSIONS.SCHOOL_DELETE}`]);
  });

  it("refuses somebody without the code, before counting anything", async () => {
    granted.clear();
    const state = await deleteSchoolAction("school-1");

    expect(state.status).toBe("error");
    expect(of("student", "count")).toEqual([]);
    expect(of("staff", "count")).toEqual([]);
    expect(of("cashOperation", "count")).toEqual([]);
    expect(of("school", "deleteMany")).toEqual([]);
  });

  it("scopes the delete by organisation, so a crafted id stays in its tenant", async () => {
    answers = { "school.deleteMany": { count: 0 } };
    const state = await deleteSchoolAction("school-from-another-org");

    expect(state.status).toBe("error");
    expect(only("school", "deleteMany").args).toMatchObject({
      where: { organizationId: "org-1" },
    });
  });
});

// ── Creating ─────────────────────────────────────────────────────────────────

describe("createSchoolAction", () => {
  it("is organisation-wide, because there is no school to scope it to yet", async () => {
    const state = await createSchoolAction(IDLE, schoolForm());
    expect(asked).toEqual([`org:${PERMISSIONS.SCHOOL_CREATE}`]);
    expect(state.status).toBe("success");
  });

  it("refuses a school-scoped holder", async () => {
    granted.clear();
    const state = await createSchoolAction(IDLE, schoolForm());
    expect(state.status).toBe("error");
    expect(of("school", "create")).toEqual([]);
  });

  it("files the school under the caller's own organisation", async () => {
    // Never from the form: this is the tenant boundary.
    const form = schoolForm();
    form.set("organizationId", "another-org");
    await createSchoolAction(IDLE, form);

    const data = (only("school", "create").args as {
      data: Record<string, unknown>;
    }).data;
    expect(data["organizationId"]).toBe("org-1");
  });

  it("names a duplicate code rather than letting the index throw one", async () => {
    answers = { "school.findUnique": { id: "school-2" } };
    const state = await createSchoolAction(IDLE, schoolForm());

    expect(state.status).toBe("error");
    expect(state.fieldErrors).toMatchObject({ code: t.school.codeTaken });
    expect(of("school", "create")).toEqual([]);
  });

  it("names a MASSAR code already mapped to another school", async () => {
    // The nullable-unique index would throw; caught so a clash names the field
    // to change rather than a stack trace.
    answers = { "school.findFirst": { id: "school-2" } };
    const state = await createSchoolAction(
      IDLE,
      schoolForm({ massarCode: "53747V" }),
    );

    expect(state.status).toBe("error");
    expect(state.fieldErrors).toMatchObject({
      massarCode: t.school.massarTaken,
    });
    expect(of("school", "create")).toEqual([]);
  });

  it("does not look for a clash when the school is unmapped", async () => {
    // Many schools legitimately hold no MASSAR code, and every one of them
    // would collide on a bare uniqueness check.
    await createSchoolAction(IDLE, schoolForm({ massarCode: "" }));
    expect(of("school", "findFirst")).toEqual([]);
  });

  it("looks for a clash inside its own organisation", async () => {
    await createSchoolAction(IDLE, schoolForm({ massarCode: "53747V" }));
    expect(only("school", "findFirst").args).toMatchObject({
      where: { organizationId: "org-1", massarCode: "53747V" },
    });
  });
});

// ── Editing ──────────────────────────────────────────────────────────────────

describe("updateSchoolAction", () => {
  it("lets a director edit their own school", async () => {
    const state = await updateSchoolAction(IDLE, schoolForm());
    expect(asked).toEqual([`school:${PERMISSIONS.SCHOOL_UPDATE}`]);
    expect(state.status).toBe("success");
  });

  it("refuses a school the caller cannot reach", async () => {
    // Scoped rather than org-wide: editing is not closing.
    reachable = ["school-1"];
    const state = await updateSchoolAction(
      IDLE,
      schoolForm({ id: "school-2" }),
    );

    expect(state.status).toBe("error");
    expect(of("school", "updateMany")).toEqual([]);
  });

  it("scopes the write by organisation as well as by id", async () => {
    // So a crafted id cannot reach another tenant's row even if the checks
    // above were ever relaxed.
    await updateSchoolAction(IDLE, schoolForm());
    expect(only("school", "updateMany").args).toMatchObject({
      where: { id: "school-1", organizationId: "org-1" },
    });
  });

  it("excludes the school itself from both clash checks", async () => {
    // Saving a school without changing its code must not collide with itself.
    await updateSchoolAction(IDLE, schoolForm({ massarCode: "53747V" }));
    for (const call of of("school", "findFirst")) {
      expect(call.args).toMatchObject({ where: { NOT: { id: "school-1" } } });
    }
  });

  it("never lets the organisation travel in the form", async () => {
    const form = schoolForm();
    form.set("organizationId", "another-org");
    await updateSchoolAction(IDLE, form);

    const data = (only("school", "updateMany").args as {
      data: Record<string, unknown>;
    }).data;
    expect(data).not.toHaveProperty("organizationId");
  });

  it("reports not-found when the write matched nothing", async () => {
    answers = { "school.updateMany": { count: 0 } };
    const state = await updateSchoolAction(IDLE, schoolForm());
    expect(state.status).toBe("error");
    expect(state.message).toBe(t.errors.notFound);
  });
});

// ── The form ─────────────────────────────────────────────────────────────────

describe("the school form", () => {
  it("upper-cases the code and the country before they are checked", async () => {
    // The uniqueness check is on the stored value, so "als" and "ALS" have to
    // be the same code before anybody looks for a clash.
    await createSchoolAction(IDLE, schoolForm({ code: "als", country: "ma" }));

    const data = (only("school", "create").args as {
      data: Record<string, unknown>;
    }).data;
    expect(data["code"]).toBe("ALS");
    expect(data["country"]).toBe("MA");
  });

  it("looks for the clash on the upper-cased code", async () => {
    await createSchoolAction(IDLE, schoolForm({ code: "als" }));
    expect(only("school", "findUnique").args).toMatchObject({
      where: { organizationId_code: { organizationId: "org-1", code: "ALS" } },
    });
  });
});

describe("schoolSchema", () => {
  const form = (extra: Record<string, unknown> = {}) => ({
    code: "ALS",
    name: "Al Massira",
    massarCode: "",
    level: "GROUP",
    directorName: "",
    capacity: "",
    email: "",
    phone: "",
    website: "",
    logoUrl: "",
    addressLine: "",
    city: "",
    region: "",
    postalCode: "",
    country: "MA",
    isActive: true,
    ...extra,
  });

  it("accepts a well-formed school", () => {
    expect(schoolSchema(t).safeParse(form()).success).toBe(true);
  });

  it("requires a code and a name", () => {
    expect(schoolSchema(t).safeParse(form({ code: "" })).success).toBe(false);
    expect(schoolSchema(t).safeParse(form({ name: "" })).success).toBe(false);
  });

  it("refuses a code that would not survive a URL", () => {
    for (const code of ["A LS", "A/LS", "A.LS", "../etc"]) {
      expect(schoolSchema(t).safeParse(form({ code })).success, code).toBe(
        false,
      );
    }
  });

  it("accepts every level a school may be", () => {
    for (const level of SCHOOL_LEVELS) {
      expect(schoolSchema(t).safeParse(form({ level })).success, level).toBe(
        true,
      );
    }
    for (const level of ["", "SCHOOL", "group"]) {
      expect(schoolSchema(t).safeParse(form({ level })).success, level).toBe(
        false,
      );
    }
  });

  it("refuses a logo that is not an image", () => {
    // A school's crest renders on the login page for every visitor.
    for (const logoUrl of [
      "javascript:alert(1)",
      "data:text/html;base64,AA",
      "http://example.com/crest.png",
    ]) {
      expect(schoolSchema(t).safeParse(form({ logoUrl })).success, logoUrl).toBe(
        false,
      );
    }
    expect(
      schoolSchema(t).safeParse(form({ logoUrl: "https://example.com/c.png" }))
        .success,
    ).toBe(true);
  });

  it("reads a blank optional field as null rather than empty text", () => {
    const parsed = schoolSchema(t).safeParse(form());
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.massarCode).toBeNull();
      expect(parsed.data.capacity).toBeNull();
      expect(parsed.data.email).toBeNull();
      expect(parsed.data.logoUrl).toBeNull();
    }
  });

  it("strips anything the form did not declare", () => {
    // Not the tenant, not the id, and not the settings — those are their own
    // screen.
    const parsed = schoolSchema(t).safeParse({
      ...form(),
      id: "another-school",
      organizationId: "another-org",
      gradingMaxScore: 40,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      for (const field of ["id", "organizationId", "gradingMaxScore"]) {
        expect(parsed.data, field).not.toHaveProperty(field);
      }
    }
  });
});
