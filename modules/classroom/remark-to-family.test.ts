import { beforeEach, describe, expect, it, vi } from "vitest";

import { webHref } from "@/modules/notifications/enums";

/**
 * The carnet's half of "a teacher never reaches a family directly".
 *
 * `classroom-actions.test.ts` already draws the line at the action: a teacher
 * without `classroom.remarkPublish` writes an internal note whatever the form
 * said. This file draws it one layer down, at the service, and asks the question
 * the action cannot answer — **who was told**.
 *
 * The two are genuinely different failures. An observation could be stored
 * correctly as internal and still be announced to the household, because storing
 * and notifying are separate statements a few lines apart; that is precisely how
 * the devoir path broke (see `assessments/teacher-to-family.test.ts`). So the
 * assertions here are about the recipients, not the row.
 *
 * The shape of the flow, and what each test pins:
 *
 *   teacher writes  →  REMARK_WRITTEN to whoever may release it, family silent
 *   office releases →  REMARK_SHARED to the household, and only on release
 */

const SCHOOL = "school-1";
const ORG = "org-1";
const TEACHER = "teacher-1";
const DIRECTOR = "director-1";
const GUARDIAN = "guardian-1";

type Written = {
  kind: string;
  userId: string;
  subjectId: string | null;
  params: Record<string, string>;
};

const written: Written[] = [];
const resolved: string[] = [];
const stored: Record<string, unknown>[] = [];
const visibilityUpdates: Record<string, unknown>[] = [];

/** Set by the tests to make the scoped lookup miss, as a crafted id would. */
let enrolmentExists = true;
let remarkExists = true;

function reset() {
  written.length = 0;
  resolved.length = 0;
  stored.length = 0;
  visibilityUpdates.length = 0;
  enrolmentExists = true;
  remarkExists = true;
}

vi.mock("@/lib/db", () => ({
  db: {
    enrollment: {
      findFirst: async () => (enrolmentExists ? { id: "enrolment-1" } : null),
    },
    studentRemark: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        stored.push(data);
        return { id: "remark-1" };
      },
      findFirst: async () =>
        remarkExists
          ? {
              id: "remark-1",
              enrollment: {
                studentId: "student-1",
                student: {
                  firstName: "Yasmine",
                  lastName: "Alaoui",
                  school: { organizationId: ORG },
                },
              },
              author: {
                email: "b@x.ma",
                profile: { firstName: "Nadia", lastName: "B." },
              },
            }
          : null,
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        if (!remarkExists) return { count: 0 };
        visibilityUpdates.push(data);
        return { count: 1 };
      },
    },
  },
  auditClient: {},
}));

vi.mock("@/lib/audit", () => ({ recordEvent: async () => {} }));

// Faked for the same reason as in the assessments companion: what is under test
// is *which resolver each path chose*, which is what separates the office from
// the household.
vi.mock("@/modules/notifications/service", () => ({
  dispatch: async (_label: string, work: () => Promise<unknown>) => {
    try {
      await work();
    } catch {
      /* swallowed, exactly as in production */
    }
  },
  notify: async (input: {
    kind: string;
    subjectId?: string | null;
    params?: Record<string, unknown>;
    targets: { userId: string; params?: Record<string, unknown> }[];
  }) => {
    for (const target of input.targets) {
      written.push({
        kind: input.kind,
        userId: target.userId,
        subjectId: input.subjectId ?? null,
        params: Object.fromEntries(
          Object.entries({ ...input.params, ...target.params }).map(
            ([key, value]) => [key, String(value)],
          ),
        ),
      });
    }
    return input.targets.length;
  },
  staffHolding: async (_org: string, _school: string, code: string) => {
    resolved.push(`staffHolding:${code}`);
    return [{ userId: DIRECTOR }, { userId: TEACHER }];
  },
  guardiansOfStudent: async () => {
    resolved.push("guardiansOfStudent");
    return [{ userId: GUARDIAN, studentId: "student-1" }];
  },
  guardiansOf: async () => {
    resolved.push("guardiansOf");
    return [{ userId: GUARDIAN, studentId: "student-1" }];
  },
  guardiansOfClass: async () => {
    resolved.push("guardiansOfClass");
    return [{ userId: GUARDIAN, studentId: "student-1" }];
  },
}));

const { writeRemark, setRemarkVisibility } = await import(
  "@/modules/classroom/service"
);

const remarkInput = {
  authorId: TEACHER,
  schoolId: SCHOOL,
  actsForSchool: false,
  enrollmentId: "enrolment-1",
  subjectId: null,
  kind: "BEHAVIOUR",
  tone: "CONCERN",
  body: "A cessé d'apporter son cahier.",
  occurredOn: new Date("2026-03-04"),
  isVisibleToFamily: false,
};

const recipientsOf = (kind: string) =>
  written.filter((row) => row.kind === kind).map((row) => row.userId);

beforeEach(reset);

// ─────────────────────────────────────────────────────────────────────────────

describe("a teacher writing an observation", () => {
  it("stores it internal", async () => {
    const result = await writeRemark(remarkInput);

    expect(result).toEqual({ ok: true });
    expect(stored[0].isVisibleToFamily).toBe(false);
  });

  it("tells whoever may release it", async () => {
    await writeRemark(remarkInput);

    expect(recipientsOf("REMARK_WRITTEN")).toEqual([DIRECTOR]);
    expect(resolved).toContain("staffHolding:classroom.remarkPublish");
  });

  it("never resolves a guardian", async () => {
    await writeRemark(remarkInput);

    /*
      On the resolver, not on the absence of a guardian in `written` — a school
      with nobody's parents on file yet would pass the weaker assertion no matter
      what the code did.
    */
    expect(resolved.some((call) => call.startsWith("guardians"))).toBe(false);
    expect(written.every((row) => row.userId !== GUARDIAN)).toBe(true);
  });

  it("does not tell the author about their own note", async () => {
    await writeRemark(remarkInput);

    // The office writing one under their own name has not created work for
    // themselves — the fastest way to teach somebody to ignore a bell.
    expect(recipientsOf("REMARK_WRITTEN")).not.toContain(TEACHER);
  });

  it("names the child and the colleague, and not the words", async () => {
    await writeRemark(remarkInput);

    const line = written.find((row) => row.kind === "REMARK_WRITTEN");
    expect(line?.params.child).toBe("Yasmine Alaoui");
    expect(line?.params.teacher).toBe("Nadia B.");
    /*
      A remark is a judgement about a child, read on a lock screen in front of
      whoever is standing there. The text belongs on the screen behind the line,
      which is where somebody chooses to read it.
    */
    expect(Object.values(line?.params ?? {})).not.toContain(remarkInput.body);
  });

  it("tells nobody about a pupil the teacher does not teach", async () => {
    enrolmentExists = false;

    const result = await writeRemark(remarkInput);

    expect(result).toEqual({ ok: false });
    expect(stored).toHaveLength(0);
    expect(written).toHaveLength(0);
  });

  it("stays silent when the office writes one already released", async () => {
    // `isVisibleToFamily` true here means the author already held the publish
    // code and used it — there is no decision pending for anybody to be told of.
    await writeRemark({ ...remarkInput, isVisibleToFamily: true });

    expect(recipientsOf("REMARK_WRITTEN")).toEqual([]);
  });
});

describe("the office releasing it", () => {
  it("is what reaches the household", async () => {
    const result = await setRemarkVisibility("remark-1", SCHOOL, true);

    expect(result).toEqual({ ok: true });
    expect(visibilityUpdates[0]).toEqual({ isVisibleToFamily: true });
    expect(recipientsOf("REMARK_SHARED")).toEqual([GUARDIAN]);
    expect(resolved).toContain("guardiansOfStudent");
  });

  it("says nothing when the office takes one back", async () => {
    await setRemarkVisibility("remark-1", SCHOOL, false);

    /*
      Withdrawing is the office reconsidering. A family who never saw it has
      nothing to be told, and one who did is not helped by a second line drawing
      attention to it.
    */
    expect(written).toHaveLength(0);
    expect(visibilityUpdates[0]).toEqual({ isVisibleToFamily: false });
  });

  it("reaches nothing with an id from another school", async () => {
    remarkExists = false;

    const result = await setRemarkVisibility("remark-1", SCHOOL, true);

    expect(result).toEqual({ ok: false });
    expect(written).toHaveLength(0);
  });

  it("never touches the teacher's words", async () => {
    await setRemarkVisibility("remark-1", SCHOOL, true);

    // Publishing is a decision about a colleague's observation, not a licence to
    // edit it. The update carries the flag and nothing else.
    expect(Object.keys(visibilityUpdates[0])).toEqual(["isVisibleToFamily"]);
  });
});

describe("where each side of the carnet lands", () => {
  it("sends the office to the screen where the decision is made", () => {
    expect(webHref("REMARK_WRITTEN", { subjectId: "remark-1" })).toBe(
      "/school-life/remarks",
    );
  });

  it("sends the family nowhere on the web, because they may not go there", () => {
    // A guardian holds no membership, so every dashboard screen answers them
    // with the forbidden state. Their route is the phone's.
    expect(webHref("REMARK_SHARED", { subjectId: "remark-1" })).toBeNull();
  });
});
