import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/permissions";
import { getDictionaryFor } from "@/lib/i18n/server";
import {
  GROUP_PURPOSES,
  assignmentScopeKey,
  offeringScopeKey,
} from "@/modules/classes/enums";

/**
 * La classe: who sits in it, and who teaches it.
 *
 * Creating a class is configuration and lives elsewhere; what this module
 * grants is the *running* of one that exists, and the two halves are held by
 * different people — which is why `class.roster` and `class.assignTeacher` are
 * two codes rather than one.
 *
 * One rule here the database cannot state: **exactly one primary teacher per
 * (class, group, subject)**. A partial unique index would say it and neither
 * SQLite through Prisma nor a plain constraint can, so it is three cooperating
 * statements — demote the others, write, put one back — and a rule enforced
 * that way breaks on the path nobody walked. That path is the subject of half
 * the tests below.
 *
 * The other half is the year rollover: what the shape of a school carries into
 * September, and what it deliberately leaves behind.
 */

const t = getDictionaryFor("en");

// ─────────────────────────────────────────────────────────────────────────────

const calls: { model: string; op: string; args: unknown }[] = [];
let answers: Record<string, unknown> = {};
let counts: number[] = [];
/** Rows the `owned` lookup will admit to, keyed by id. */
let ownedAssignments: Record<string, string> = {};

const db = new Proxy(
  {},
  {
    get: (_target, model: string) =>
      new Proxy(
        {},
        {
          get: (_d, op: string) => async (args: unknown) => {
            calls.push({ model, op, args });
            if (op === "count") return counts.shift() ?? 0;

            if (model === "teachingAssignment" && op === "findFirst") {
              const where = (args as { where: Record<string, unknown> }).where;
              // The action's ownership lookup: id *and* class together.
              if (where["id"]) {
                const owner = ownedAssignments[where["id"] as string];
                return owner && owner === where["schoolClassId"]
                  ? { id: where["id"] }
                  : null;
              }
            }

            const key = `${model}.${op}`;
            if (key in answers) return answers[key];
            return op === "findMany"
              ? []
              : op === "findFirst" || op === "findUnique"
                ? null
                : op === "updateMany"
                  ? { count: 0 }
                  : { id: "created" };
          },
        },
      ),
  },
);

vi.mock("@/lib/db", () => ({ db, auditClient: {} }));
vi.mock("@/lib/audit", () => ({ recordEvent: async () => {} }));

const granted = new Set<string>();
const asked: string[] = [];

class ForbiddenError extends Error {
  readonly permission?: string;
  constructor(permission?: string) {
    super("Forbidden");
    this.permission = permission;
    this.name = "ForbiddenError";
  }
}

vi.mock("@/lib/dal", () => ({
  ForbiddenError,
  authorizeSchool: async (schoolId: string, permission: string) => {
    asked.push(permission);
    if (!granted.has(permission)) throw new ForbiddenError(permission);
    return { currentSchool: { id: schoolId } };
  },
}));

vi.mock("@/lib/i18n/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/server")>()),
  getDictionary: async () => t,
}));

vi.mock("next/cache", () => ({ refresh: () => {} }));

const {
  clearOtherPrimaryTeachers,
  copyClassStructure,
  ensurePrimaryTeacher,
  saveTeachingAssignment,
} = await import("@/modules/classes/service");
const { deleteTeachingAssignmentAction, saveTeachingAssignmentAction } =
  await import("@/modules/classes/actions");

const of = (model: string, op: string) =>
  calls.filter((call) => call.model === model && call.op === op);

const only = (model: string, op: string) => {
  const matches = of(model, op);
  expect(matches, `${model}.${op}`).toHaveLength(1);
  return matches[0]!;
};

const IDLE = { status: "idle" } as never;

function assignmentForm(extra: Record<string, string> = {}) {
  const form = new FormData();
  form.set("schoolClassId", "class-1");
  form.set("subjectId", "maths");
  form.set("teacherId", "teacher-1");
  form.set("classGroupId", "__none__");
  form.set("weeklyMinutes", "240");
  for (const [key, value] of Object.entries(extra)) form.set(key, value);
  return form;
}

/** The school, subject and teacher all resolve; nothing is assigned yet. */
function resolvable() {
  answers = {
    "schoolClass.findUnique": { id: "class-1", schoolId: "school-1" },
    "subject.findFirst": { id: "maths" },
    "user.findFirst": { id: "teacher-1" },
    "classGroup.findFirst": { id: "group-a" },
  };
}

beforeEach(() => {
  calls.length = 0;
  answers = {};
  counts = [];
  ownedAssignments = {};
  asked.length = 0;
  granted.clear();
  granted.add(PERMISSIONS.CLASS_VIEW);
  granted.add(PERMISSIONS.CLASS_ROSTER);
  granted.add(PERMISSIONS.CLASS_ASSIGN_TEACHER);
});

// ── The nullable mirrors ─────────────────────────────────────────────────────

describe("the scope keys", () => {
  it("stops a track-less level being opened twice in one year", () => {
    // SQLite treats NULLs as distinct in a unique index, so a null `trackId`
    // could otherwise be inserted any number of times.
    expect(offeringScopeKey(null)).toBe(offeringScopeKey(undefined));
    expect(offeringScopeKey(null)).not.toBe(offeringScopeKey("track-sm"));
    expect(offeringScopeKey("track-sm")).not.toBe(offeringScopeKey("track-pc"));
  });

  it("stops a duplicate whole-class assignment", () => {
    // Without it the same teacher could be assigned twice to the same subject
    // for the whole class, double-counting their load.
    expect(assignmentScopeKey(null)).toBe(assignmentScopeKey(undefined));
    expect(assignmentScopeKey(null)).not.toBe(assignmentScopeKey("group-a"));
  });

  it("keys a group's assignment on the group", () => {
    expect(assignmentScopeKey("group-a")).not.toBe(
      assignmentScopeKey("group-b"),
    );
  });

  it("names the reasons a class is actually split", () => {
    expect([...GROUP_PURPOSES]).toEqual([
      "LAB",
      "LANGUAGE",
      "SPORTS",
      "SUPPORT",
      "OTHER",
    ]);
    expect(GROUP_PURPOSES.at(-1)).toBe("OTHER");
  });
});

// ── Exactly one primary teacher ──────────────────────────────────────────────

describe("the primary teacher", () => {
  it("demotes whoever held the subject in that class", async () => {
    await clearOtherPrimaryTeachers("class-1", "maths", null, "assign-2");

    expect(only("teachingAssignment", "updateMany").args).toMatchObject({
      where: {
        schoolClassId: "class-1",
        subjectId: "maths",
        classGroupId: null,
        isPrimary: true,
        NOT: { id: "assign-2" },
      },
      data: { isPrimary: false },
    });
  });

  it("keeps the promotion out of its own sweep", async () => {
    await clearOtherPrimaryTeachers("class-1", "maths", null, "assign-2");
    const where = (only("teachingAssignment", "updateMany").args as {
      where: { NOT?: { id: string } };
    }).where;
    expect(where.NOT!.id).toBe("assign-2");
  });

  it("sweeps unqualified when there is nothing yet to keep", async () => {
    await clearOtherPrimaryTeachers("class-1", "maths", null);
    const where = (only("teachingAssignment", "updateMany").args as {
      where: Record<string, unknown>;
    }).where;
    expect(where).not.toHaveProperty("NOT");
  });

  it("treats a group's primary as separate from the whole class's", async () => {
    // A subject split in halves has one answerable teacher per half.
    await clearOtherPrimaryTeachers("class-1", "maths", "group-a");
    expect(only("teachingAssignment", "updateMany").args).toMatchObject({
      where: { classGroupId: "group-a" },
    });
  });

  it("never reaches past the class and the subject", async () => {
    await clearOtherPrimaryTeachers("class-1", "maths", null);
    const where = (only("teachingAssignment", "updateMany").args as {
      where: Record<string, unknown>;
    }).where;
    expect(where["schoolClassId"]).toBe("class-1");
    expect(where["subjectId"]).toBe("maths");
  });
});

describe("saveTeachingAssignment", () => {
  it("stamps the scope key from the group, and nowhere else", async () => {
    await saveTeachingAssignment({
      schoolClassId: "class-1",
      subjectId: "maths",
      teacherId: "teacher-1",
      classGroupId: "group-a",
      weeklyMinutes: 240,
      isPrimary: false,
    });

    const data = (only("teachingAssignment", "create").args as {
      data: Record<string, unknown>;
    }).data;
    expect(data["scopeKey"]).toBe(assignmentScopeKey("group-a"));
  });

  it("demotes the others only when promoting one", async () => {
    await saveTeachingAssignment({
      schoolClassId: "class-1",
      subjectId: "maths",
      teacherId: "teacher-1",
      classGroupId: null,
      weeklyMinutes: null,
      isPrimary: false,
    });
    expect(of("teachingAssignment", "updateMany")).toEqual([]);
  });

  it("demotes before writing when it is", async () => {
    await saveTeachingAssignment({
      schoolClassId: "class-1",
      subjectId: "maths",
      teacherId: "teacher-1",
      classGroupId: null,
      weeklyMinutes: null,
      isPrimary: true,
    });
    expect(of("teachingAssignment", "updateMany")).toHaveLength(1);
    expect(of("teachingAssignment", "create")).toHaveLength(1);
  });
});

describe("ensurePrimaryTeacher", () => {
  it("does nothing when somebody already answers for the subject", async () => {
    answers = { "teachingAssignment.findFirst": { id: "assign-1" } };
    await ensurePrimaryTeacher("class-1", "maths", null);
    expect(of("teachingAssignment", "update")).toEqual([]);
  });

  it("promotes the longest-standing teacher when nobody does", async () => {
    // Somebody has to stay answerable for the subject's marks.
    let seen = 0;
    answers = {
      get "teachingAssignment.findFirst"() {
        seen += 1;
        return seen === 1 ? null : { id: "assign-3" };
      },
    } as unknown as Record<string, unknown>;

    await ensurePrimaryTeacher("class-1", "maths", null);
    expect(only("teachingAssignment", "update").args).toMatchObject({
      where: { id: "assign-3" },
      data: { isPrimary: true },
    });
    expect(of("teachingAssignment", "findFirst")[1]!.args).toMatchObject({
      orderBy: { createdAt: "asc" },
    });
  });

  it("does nothing when nobody teaches it at all", async () => {
    await ensurePrimaryTeacher("class-1", "maths", null);
    expect(of("teachingAssignment", "update")).toEqual([]);
  });
});

// ── The action, which is what makes the ordering safe ────────────────────────

describe("saveTeachingAssignmentAction", () => {
  it("resolves the school from the class and authorizes against it", async () => {
    resolvable();
    const state = await saveTeachingAssignmentAction(IDLE, assignmentForm());

    expect(asked).toEqual([PERMISSIONS.CLASS_ASSIGN_TEACHER]);
    expect(state.status).toBe("success");
  });

  it("refuses a class nobody declared", async () => {
    const state = await saveTeachingAssignmentAction(IDLE, assignmentForm());
    expect(state.status).toBe("error");
    expect(asked).toEqual([]);
    expect(of("teachingAssignment", "create")).toEqual([]);
  });

  it("refuses somebody without the code", async () => {
    resolvable();
    granted.clear();
    granted.add(PERMISSIONS.CLASS_VIEW);

    const state = await saveTeachingAssignmentAction(IDLE, assignmentForm());
    expect(state.status).toBe("error");
    expect(of("teachingAssignment", "create")).toEqual([]);
  });

  it("checks the subject, the teacher and the group against that school", async () => {
    resolvable();
    await saveTeachingAssignmentAction(
      IDLE,
      assignmentForm({ classGroupId: "group-a" }),
    );

    expect(only("subject", "findFirst").args).toMatchObject({
      where: { id: "maths", schoolId: "school-1" },
    });
    expect(only("user", "findFirst").args).toMatchObject({
      where: {
        id: "teacher-1",
        isActive: true,
        memberships: { some: { schoolId: "school-1" } },
      },
    });
    expect(only("classGroup", "findFirst").args).toMatchObject({
      where: { id: "group-a", schoolClassId: "class-1" },
    });
  });

  it("refuses a teacher who has left", async () => {
    // `isActive` is part of the lookup rather than a check afterwards, so a
    // deactivated account cannot be handed a class.
    resolvable();
    answers["user.findFirst"] = null;

    const state = await saveTeachingAssignmentAction(IDLE, assignmentForm());
    expect(state.status).toBe("error");
    expect(state.message).toBe(t.schoolClass.teacherUnavailable);
    expect(of("teachingAssignment", "create")).toEqual([]);
  });

  // ── The guard that makes the demotion safe ─────────────────────────────────

  it("demotes nobody until the assignment has been resolved", async () => {
    // The hazard: promoting a primary teacher clears whoever held it, and the
    // service does that *before* it writes. An `id` from another class would
    // therefore demote this class's teacher and then fail — which is exactly
    // what went wrong in the families module. Here the action refuses first, so
    // the sweep never runs.
    resolvable();
    ownedAssignments = { "assign-elsewhere": "class-9" };

    const state = await saveTeachingAssignmentAction(
      IDLE,
      assignmentForm({ id: "assign-elsewhere", isPrimary: "on" }),
    );

    expect(state.status).toBe("error");
    expect(of("teachingAssignment", "updateMany")).toEqual([]);
    expect(of("teachingAssignment", "update")).toEqual([]);
  });

  it("refuses an assignment id nobody declared", async () => {
    resolvable();
    const state = await saveTeachingAssignmentAction(
      IDLE,
      assignmentForm({ id: "nowhere", isPrimary: "on" }),
    );

    expect(state.status).toBe("error");
    expect(of("teachingAssignment", "updateMany")).toEqual([]);
  });

  it("still demotes the others when the promotion is real", async () => {
    // The fix must not cost the rule it protects.
    resolvable();
    ownedAssignments = { "assign-1": "class-1" };

    const state = await saveTeachingAssignmentAction(
      IDLE,
      assignmentForm({ id: "assign-1", isPrimary: "on" }),
    );

    expect(state.status).toBe("success");
    expect(of("teachingAssignment", "updateMany")).toHaveLength(1);
  });

  it("names a duplicate rather than letting the index throw one", async () => {
    // A duplicate-key stack trace is not a message a secretary can act on.
    resolvable();
    answers["teachingAssignment.findFirst"] = { id: "assign-1" };

    const state = await saveTeachingAssignmentAction(IDLE, assignmentForm());
    expect(state.status).toBe("error");
    expect(state.message).toBe(t.schoolClass.assignmentExists);
    expect(of("teachingAssignment", "create")).toEqual([]);
  });

  it("puts somebody back in charge after every save", async () => {
    resolvable();
    await saveTeachingAssignmentAction(IDLE, assignmentForm());
    // `ensurePrimaryTeacher` reads before it decides; the read having happened
    // is what says the repair ran.
    expect(of("teachingAssignment", "findFirst").length).toBeGreaterThan(0);
  });
});

describe("deleteTeachingAssignmentAction", () => {
  it("authorizes through the assignment's own class", async () => {
    answers = {
      "teachingAssignment.findUnique": {
        id: "assign-1",
        schoolClassId: "class-1",
        subjectId: "maths",
        classGroupId: null,
        schoolClass: { schoolId: "school-1" },
      },
    };
    const state = await deleteTeachingAssignmentAction("assign-1");

    expect(asked).toEqual([PERMISSIONS.CLASS_ASSIGN_TEACHER]);
    expect(state.status).toBe("success");
  });

  it("refuses one nobody declared", async () => {
    const state = await deleteTeachingAssignmentAction("nowhere");
    expect(state.status).toBe("error");
    expect(of("teachingAssignment", "delete")).toEqual([]);
  });

  it("refuses somebody without the code, before deleting", async () => {
    answers = {
      "teachingAssignment.findUnique": {
        id: "assign-1",
        schoolClassId: "class-1",
        subjectId: "maths",
        classGroupId: null,
        schoolClass: { schoolId: "school-1" },
      },
    };
    granted.clear();

    const state = await deleteTeachingAssignmentAction("assign-1");
    expect(state.status).toBe("error");
    expect(of("teachingAssignment", "delete")).toEqual([]);
  });

  it("leaves somebody answerable for the subject afterwards", async () => {
    answers = {
      "teachingAssignment.findUnique": {
        id: "assign-1",
        schoolClassId: "class-1",
        subjectId: "maths",
        classGroupId: null,
        schoolClass: { schoolId: "school-1" },
      },
    };
    await deleteTeachingAssignmentAction("assign-1");
    expect(of("teachingAssignment", "findFirst").length).toBeGreaterThan(0);
  });
});

// ── Carrying the shape of the school into a new year ─────────────────────────

const offering = (extra: Record<string, unknown> = {}) => ({
  id: "offering-1",
  schoolYearId: "year-1",
  levelId: "level-3ap",
  trackId: null,
  plannedCapacity: 90,
  isActive: true,
  scopeKey: "",
  classes: [],
  ...extra,
});

const schoolClass = (extra: Record<string, unknown> = {}) => ({
  id: "class-1",
  schoolId: "school-1",
  code: "3AP-A",
  name: null,
  section: null,
  capacity: 30,
  mainTeacherId: "teacher-1",
  roomId: "room-12",
  isActive: true,
  groups: [],
  ...extra,
});

const group = (extra: Record<string, unknown> = {}) => ({
  id: "group-1",
  code: "G1",
  name: null,
  purpose: "LANGUAGE",
  subjectId: "anglais",
  capacity: 15,
  isActive: true,
  ...extra,
});

describe("copyClassStructure", () => {
  const structure = (offerings: unknown[]) => {
    answers = { "levelOffering.findMany": offerings };
  };

  it("carries the levels, their classes and their groups", async () => {
    structure([offering({ classes: [schoolClass({ groups: [group()] })] })]);
    counts = [0, 0, 0, 1, 1, 1];

    const result = await copyClassStructure("year-1", "year-2");
    expect(result).toEqual({ offerings: 1, classes: 1, groups: 1 });
  });

  it("carries no pupil", async () => {
    // Enrolments are the year's own business and a new year starts empty —
    // that split is the whole reason Student and Enrollment are separate.
    structure([offering({ classes: [schoolClass()] })]);
    counts = [0, 0, 0, 1, 1, 0];
    await copyClassStructure("year-1", "year-2");

    expect(of("enrollment", "create")).toEqual([]);
    expect(of("enrollment", "upsert")).toEqual([]);
  });

  it("carries the room but not the professeur principal", async () => {
    // Staff turnover over a summer is exactly where a copied grid goes stale,
    // and a wrong name on a class is worse than a blank one. A room is a
    // building, and buildings do not resign.
    structure([offering({ classes: [schoolClass()] })]);
    counts = [0, 0, 0, 1, 1, 0];
    await copyClassStructure("year-1", "year-2");

    const create = (only("schoolClass", "upsert").args as {
      create: Record<string, unknown>;
    }).create;
    expect(create["mainTeacherId"]).toBeNull();
    expect(create["roomId"]).toBe("room-12");
  });

  it("never overwrites what somebody has already edited", async () => {
    // A copy run onto a year already begun adds what is missing and touches
    // nothing else.
    structure([offering({ classes: [schoolClass({ groups: [group()] })] })]);
    counts = [1, 1, 1, 1, 1, 1];

    const result = await copyClassStructure("year-1", "year-2");
    for (const model of ["levelOffering", "schoolClass", "classGroup"]) {
      expect((only(model, "upsert").args as { update: unknown }).update, model)
        .toEqual({});
    }
    expect(result).toEqual({ offerings: 0, classes: 0, groups: 0 });
  });

  it("counts what it added, not what it tried to", async () => {
    structure([offering({ classes: [schoolClass(), schoolClass({ code: "3AP-B" })] })]);
    counts = [1, 2, 0, 1, 4, 0];

    const result = await copyClassStructure("year-1", "year-2");
    expect(result).toEqual({ offerings: 0, classes: 2, groups: 0 });
  });

  it("writes each class under the offering it just resolved", async () => {
    // Not the source's offering id — that belongs to last year.
    structure([offering({ classes: [schoolClass()] })]);
    counts = [0, 0, 0, 1, 1, 0];
    await copyClassStructure("year-1", "year-2");

    expect(only("schoolClass", "upsert").args).toMatchObject({
      where: { levelOfferingId_code: { levelOfferingId: "created", code: "3AP-A" } },
      create: { levelOfferingId: "created" },
    });
  });

  it("writes each group under the class it just resolved", async () => {
    structure([offering({ classes: [schoolClass({ groups: [group()] })] })]);
    counts = [0, 0, 0, 1, 1, 1];
    await copyClassStructure("year-1", "year-2");

    expect(only("classGroup", "upsert").args).toMatchObject({
      where: { schoolClassId_code: { schoolClassId: "created", code: "G1" } },
    });
  });

  it("keys an offering on the year, the level and the track", async () => {
    structure([offering({ trackId: "track-sm", scopeKey: "track-sm" })]);
    counts = [0, 0, 0, 1, 0, 0];
    await copyClassStructure("year-1", "year-2");

    expect(only("levelOffering", "upsert").args).toMatchObject({
      where: {
        schoolYearId_levelId_scopeKey: {
          schoolYearId: "year-2",
          levelId: "level-3ap",
          scopeKey: "track-sm",
        },
      },
    });
  });

  it("carries a withdrawn class across as withdrawn", async () => {
    structure([offering({ classes: [schoolClass({ isActive: false })] })]);
    counts = [0, 0, 0, 1, 1, 0];
    await copyClassStructure("year-1", "year-2");

    const create = (only("schoolClass", "upsert").args as {
      create: Record<string, unknown>;
    }).create;
    expect(create["isActive"]).toBe(false);
  });

  it("writes nothing for a year with no structure", async () => {
    structure([]);
    counts = [0, 0, 0, 0, 0, 0];

    const result = await copyClassStructure("year-1", "year-2");
    expect(result).toEqual({ offerings: 0, classes: 0, groups: 0 });
    expect(of("levelOffering", "upsert")).toEqual([]);
  });

  it("counts the target year's rows through its own offerings", async () => {
    // A class belongs to a year only through its level offering, so the count
    // has to reach the year that way or it would count the whole school.
    structure([]);
    counts = [0, 0, 0, 0, 0, 0];
    await copyClassStructure("year-1", "year-2");

    expect(of("schoolClass", "count")[0]!.args).toMatchObject({
      where: { levelOffering: { schoolYearId: "year-2" } },
    });
    expect(of("classGroup", "count")[0]!.args).toMatchObject({
      where: { schoolClass: { levelOffering: { schoolYearId: "year-2" } } },
    });
  });
});
