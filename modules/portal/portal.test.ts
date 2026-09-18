import { describe, expect, it, beforeEach, vi } from "vitest";

import {
  FIRST_LOOK_WINDOW_DAYS,
  SEEN_TOPICS,
  firstLookSince,
  isSeenTopic,
} from "@/modules/portal/enums";
import { FAMILY_VISIBLE_STATUSES } from "@/modules/assessments/enums";

/**
 * The parents' space — the one corner of the app where the caller holds no
 * membership, no role and no permission, so none of the scoping the rest of the
 * codebase relies on applies.
 *
 * Everything here rests on a single claim: **an id from a phone is only ever
 * combined with the household, never used on its own**. A channel id and a
 * student id are both guessable, and without that rule changing one segment of
 * a URL reads another family's child.
 *
 * So the database is a recording proxy rather than a fixture. Every delegate
 * answers empty and remembers its arguments, which lets the tests assert the
 * thing that actually matters — the shape of the `where` — instead of asserting
 * that some hand-built fixture came back.
 */

type Call = { model: string; op: string; args: Record<string, unknown> };

const calls: Call[] = [];
/** Keyed `model.op`; anything unset falls through to an empty answer. */
let answers: Record<string, unknown> = {};

function emptyFor(op: string): unknown {
  if (op === "count") return 0;
  if (op === "findMany") return [];
  return null;
}

const db = new Proxy(
  {},
  {
    get: (_target, model: string) =>
      new Proxy(
        {},
        {
          get: (_d, op: string) =>
            async (args: Record<string, unknown> = {}) => {
              calls.push({ model, op, args });
              const key = `${model}.${op}`;
              return key in answers ? answers[key] : emptyFor(op);
            },
        },
      ),
  },
);

vi.mock("@/lib/db", () => ({ db, auditClient: {} }));

const portal = await import("@/modules/portal/queries");
const { loadMobileIdentity } = await import("@/modules/portal/identity");

const USER = "user-parent";
const FOREIGN_CHILD = "student-somebody-elses";

/** The `where` fragment every read in this module is supposed to carry. */
const HOUSEHOLD = {
  family: { guardians: { some: { userId: USER, isActive: true } } },
};


function callsTo(...models: string[]): Call[] {
  return calls.filter((call) => models.includes(call.model));
}

beforeEach(() => {
  calls.length = 0;
  answers = {};
});

// ── The rule the whole module rests on ───────────────────────────────────────

describe("householdScope", () => {
  it("confines the list of children to dossiers this account is a guardian on", async () => {
    await portal.listMyChildren(USER);

    const where = calls[0]?.args["where"] as Record<string, unknown>;
    expect(where).toMatchObject(HOUSEHOLD);
    // An inactive guardian is a guardian who was removed from the dossier.
    expect(where).toMatchObject({ isActive: true });
  });

  it("never reads a student or an enrolment without it", async () => {
    // The sweep that matters: a new query added to this file without the
    // household fragment is exactly the mistake this catches.
    await Promise.all([
      portal.listMyChildren(USER),
      portal.listMyEvents(USER),
      portal.listMyChannels(USER),
      portal.loadBadges(USER),
    ]);

    const relevant = callsTo("student", "enrollment");
    expect(relevant.length).toBeGreaterThan(0);

    for (const call of relevant) {
      const where = (call.args["where"] ?? {}) as Record<string, unknown>;
      const scoped =
        JSON.stringify(where["family"] ?? null) ===
          JSON.stringify(HOUSEHOLD.family) ||
        JSON.stringify(where["student"] ?? null) ===
          JSON.stringify(HOUSEHOLD);
      expect(scoped, `${call.model}.${call.op} is unscoped`).toBe(true);
    }
  });

  it("resolves a child id only together with the household", async () => {
    await portal.loadChildMarks(USER, FOREIGN_CHILD);

    const resolve = calls[0]!;
    expect(resolve.model).toBe("enrollment");
    expect(resolve.args["where"]).toMatchObject({
      studentId: FOREIGN_CHILD,
      student: HOUSEHOLD,
    });
  });
});

// ── A child that is not yours ────────────────────────────────────────────────

describe("a crafted student id", () => {
  /** Every read that takes a child id straight off the request. */
  const perChild = [
    ["loadChildMarks", (u: string, s: string) => portal.loadChildMarks(u, s)],
    [
      "loadChildAttendance",
      (u: string, s: string) => portal.loadChildAttendance(u, s),
    ],
    ["loadChildFees", (u: string, s: string) => portal.loadChildFees(u, s)],
    [
      "loadChildTransport",
      (u: string, s: string) => portal.loadChildTransport(u, s),
    ],
    [
      "loadChildRemarks",
      (u: string, s: string) => portal.loadChildRemarks(u, s),
    ],
    [
      "loadChildTimetable",
      (u: string, s: string) => portal.loadChildTimetable(u, s),
    ],
    [
      "loadChildDossier",
      (u: string, s: string) => portal.loadChildDossier(u, s),
    ],
    [
      "loadChildSupplies",
      (u: string, s: string) => portal.loadChildSupplies(u, s),
    ],
    [
      "loadChildDetail",
      (u: string, s: string) => portal.loadChildDetail(u, s),
    ],
  ] as const;

  it.each(perChild)(
    "%s reads nothing about the child when the household does not match",
    async (_name, run) => {
      // The proxy answers null to the resolve, which is what a child belonging
      // to another family looks like.
      await run(USER, FOREIGN_CHILD);

      const leaked = callsTo(
        "assessmentGrade",
        "studentAttendance",
        "enrollmentFee",
        "studentRemark",
        "studentDocument",
        "timetableEntry",
        "supplyList",
        "transportSubscription",
      );
      expect(leaked).toEqual([]);
    },
  );

  it.each(perChild)("%s answers an empty shape rather than throwing", async (
    _name,
    run,
  ) => {
    await expect(run(USER, FOREIGN_CHILD)).resolves.toBeDefined();
  });

  it("cannot be reached by passing an empty or odd id", async () => {
    for (const id of ["", "  ", "../../etc", "%2e%2e"]) {
      calls.length = 0;
      await portal.loadChildMarks(USER, id);
      expect(calls[0]?.args["where"]).toMatchObject({ student: HOUSEHOLD });
    }
  });
});

// ── Channels ─────────────────────────────────────────────────────────────────

describe("chat channels", () => {
  it("refuses to read a channel that is not on this household's own list", async () => {
    // `listMyChannels` answers empty here, so any channel id is somebody
    // else's — which is exactly the case a guessed id produces.
    const messages = await portal.loadChannelMessages(USER, "channel-someone");

    expect(messages).toBeNull();
    expect(callsTo("chatMessage")).toEqual([]);
  });

  it("refuses to post into one, by the same gate as reading", async () => {
    expect(await portal.canPostToChannel(USER, "channel-someone")).toBe(false);
  });

  it("builds the channel list from the household's own enrolments", async () => {
    await portal.listMyChannels(USER);

    const enrolmentRead = callsTo("enrollment")[0];
    expect(enrolmentRead?.args["where"]).toMatchObject({ student: HOUSEHOLD });
  });

  it("shows nothing when the school has not switched the parents' chat on", async () => {
    // No SchoolSettings row means every switch sits at its default, and both
    // chat switches default to off.
    answers["enrollment.findMany"] = [
      {
        schoolYearId: "year-1",
        schoolClassId: "class-1",
        schoolClass: { id: "class-1", name: "1A", code: "1A" },
        student: { schoolId: "school-1" },
      },
    ];
    answers["schoolSettings.findMany"] = [];

    expect(await portal.listMyChannels(USER)).toEqual([]);
    expect(callsTo("chatChannel")).toEqual([]);
  });

  it("hides the class channel when only the school-wide one is enabled", async () => {
    answers["enrollment.findMany"] = [
      {
        schoolYearId: "year-1",
        schoolClassId: "class-1",
        schoolClass: { id: "class-1", name: "1A", code: "1A" },
        student: { schoolId: "school-1" },
      },
    ];
    answers["schoolSettings.findMany"] = [
      {
        schoolId: "school-1",
        parentChatEnabled: true,
        parentClassChatEnabled: false,
      },
    ];

    await portal.listMyChannels(USER);

    // One channel wanted, and it is the school-wide one (no class).
    const channelReads = callsTo("chatChannel");
    expect(channelReads.length).toBeGreaterThan(0);
    expect(JSON.stringify(channelReads[0]!.args)).not.toContain("class-1");
  });
});

// ── Watermarks ───────────────────────────────────────────────────────────────

describe("markTopicSeen", () => {
  it("stamps a known topic against the caller's own id", async () => {
    await portal.markTopicSeen(USER, "MARKS");

    const write = calls.find((call) => call.model === "portalSeen");
    expect(write?.op).toBe("upsert");
    expect(write?.args["where"]).toMatchObject({
      userId_topic: { userId: USER, topic: "MARKS" },
    });
  });

  it.each(["", "marks", "EVERYTHING", "__proto__", "CHAT ", "'; DROP TABLE"])(
    "writes nothing for the unknown topic %o",
    async (topic) => {
      await portal.markTopicSeen(USER, topic);
      expect(callsTo("portalSeen")).toEqual([]);
    },
  );

  it("accepts every topic the module declares, and only those", async () => {
    for (const topic of SEEN_TOPICS) {
      calls.length = 0;
      await portal.markTopicSeen(USER, topic);
      expect(callsTo("portalSeen"), topic).toHaveLength(1);
    }
  });
});

describe("badges", () => {
  it("counts nothing at all when the household has no enrolment", async () => {
    const badges = await portal.loadBadges(USER);

    expect(badges).toEqual({
      events: 0,
      chat: 0,
      marks: 0,
      remarks: 0,
      total: 0,
    });
    expect(callsTo("event", "chatMessage", "assessmentGrade")).toEqual([]);
  });

  it("scopes the watermark read to the caller", async () => {
    await portal.loadBadges(USER);

    const seen = calls.find((call) => call.model === "portalSeen");
    expect(seen?.args["where"]).toMatchObject({ userId: USER });
  });
});

// ── What a family may see ────────────────────────────────────────────────────

describe("visibility gates", () => {
  it("shows a mark only once the paper is validated", async () => {
    // Not `COUNTED_STATUSES`, which includes PUBLISHED — the status a paper
    // takes the moment the office opens it for mark entry. Gating on that meant
    // a family read each mark as its teacher typed it, and every correction
    // before validation looked like a grade that had changed.
    expect([...FAMILY_VISIBLE_STATUSES]).toEqual(["GRADED"]);
    expect(FAMILY_VISIBLE_STATUSES).not.toContain("PUBLISHED");
    expect(FAMILY_VISIBLE_STATUSES).not.toContain("DRAFT");
  });

  it("filters marks on that gate rather than on the enrolment alone", async () => {
    answers["enrollment.findFirst"] = {
      id: "enrol-1",
      studentId: "student-mine",
      schoolYearId: "year-1",
      student: { firstName: "Sara", lastName: "Alami" },
      levelOffering: { level: { reportMaxScore: null } },
    };

    await portal.loadChildMarks(USER, "student-mine");

    const grades = callsTo("assessmentGrade")[0];
    expect(grades?.args["where"]).toMatchObject({
      enrollmentId: "enrol-1",
      assessment: { status: { in: [...FAMILY_VISIBLE_STATUSES] } },
    });
  });

  it("reads marks against the resolved enrolment, never the id from the request", async () => {
    answers["enrollment.findFirst"] = {
      id: "enrol-1",
      studentId: "student-mine",
      schoolYearId: "year-1",
      student: { firstName: "Sara", lastName: "Alami" },
      levelOffering: { level: { reportMaxScore: null } },
    };

    await portal.loadChildMarks(USER, "student-mine");

    const grades = callsTo("assessmentGrade")[0];
    expect(JSON.stringify(grades?.args["where"])).not.toContain("student-mine");
  });

  /*
    The average is on the school's scale, not on a literal twenty.

    This normalised each paper by its own maxScore and then multiplied by 20, so
    a school marking out of 100 — which SchoolSettings.gradingMaxScore exists to
    allow — showed its parents 14.5 for a child every staff screen called 72.5.
    Two numbers nobody can reconcile over a telephone.
  */
  it("normalises the average onto the school's own scale", async () => {
    answers["enrollment.findFirst"] = {
      id: "enrol-1",
      studentId: "student-mine",
      schoolYearId: "year-1",
      student: {
        firstName: "Sara",
        lastName: "Alami",
        schoolId: "school-cent",
      },
      levelOffering: { level: { reportMaxScore: null } },
    };
    answers["schoolSettings.findUnique"] = { gradingMaxScore: 100 };
    answers["assessmentGrade.findMany"] = [
      {
        id: "grade-1",
        score: 8,
        isAbsent: false,
        comment: null,
        assessment: {
          title: "Contrôle 1",
          scheduledOn: null,
          maxScore: 10,
          subject: { name: "Maths" },
          assessmentType: { name: "Contrôle" },
          term: { name: "Trimestre 1" },
        },
      },
    ];

    const result = await portal.loadChildMarks(USER, "student-mine");

    // 8/10 of a hundred, which is what the school itself would say.
    expect(result).toMatchObject({ average: 80, outOf: 100 });
  });

  it("rebases onto the child's own niveau when it overrides the school's scale", async () => {
    // The school marks out of 20 generally, but this child's niveau (a 1AP)
    // writes its own report cards out of 10.
    answers["enrollment.findFirst"] = {
      id: "enrol-1",
      studentId: "student-mine",
      schoolYearId: "year-1",
      student: { firstName: "Sara", lastName: "Alami", schoolId: "school-1" },
      levelOffering: { level: { reportMaxScore: 10 } },
    };
    answers["schoolSettings.findUnique"] = { gradingMaxScore: 20 };
    answers["assessmentGrade.findMany"] = [
      {
        id: "grade-1",
        score: 16,
        isAbsent: false,
        comment: null,
        assessment: {
          title: "Contrôle 1",
          scheduledOn: null,
          maxScore: 20,
          subject: { name: "Maths" },
          assessmentType: { name: "Contrôle" },
          term: { name: "Trimestre 1" },
        },
      },
    ];

    const result = await portal.loadChildMarks(USER, "student-mine");

    // 16/20 rebased onto /10 is 8.
    expect(result).toMatchObject({ average: 8, outOf: 10 });
  });

  it("falls back to the default scale for a child that is not this household's", async () => {
    // No enrolment resolves, so there is no school to ask — and asking one
    // would answer a question the caller has not earned the right to put.
    const result = await portal.loadChildMarks(USER, FOREIGN_CHILD);

    expect(result).toEqual({
      marks: [],
      average: null,
      outOf: 20,
      passMark: 10,
    });
    expect(callsTo("schoolSettings")).toHaveLength(0);
  });
});

// ── The first look ───────────────────────────────────────────────────────────

describe("first-look window", () => {
  it("looks back a fortnight, not to the beginning of time", () => {
    // A brand-new account has no watermark. Treating that as "everything is
    // new" opens the app on a badge of four hundred.
    const now = new Date("2026-03-15T12:00:00Z");
    const since = firstLookSince(now);

    expect(FIRST_LOOK_WINDOW_DAYS).toBe(14);
    expect(since.getTime()).toBeLessThan(now.getTime());
    const days = (now.getTime() - since.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBeCloseTo(14, 5);
  });

  it("does not mutate the date it was given", () => {
    const now = new Date("2026-03-15T12:00:00Z");
    const copy = new Date(now);
    firstLookSince(now);
    expect(now.getTime()).toBe(copy.getTime());
  });
});

describe("isSeenTopic", () => {
  it("accepts the four declared topics", () => {
    for (const topic of SEEN_TOPICS) expect(isSeenTopic(topic)).toBe(true);
  });

  it.each(["", "marks", "EVENTS ", "toString", "constructor", "__proto__"])(
    "rejects %o",
    (value) => {
      expect(isSeenTopic(value)).toBe(false);
    },
  );

  it("keeps one topic per screen a parent can actually be sent to", () => {
    expect(new Set(SEEN_TOPICS).size).toBe(SEEN_TOPICS.length);
    expect(SEEN_TOPICS).toHaveLength(4);
  });
});

// ── Which spaces the app offers ──────────────────────────────────────────────

describe("loadMobileIdentity", () => {
  type Held = { guardian?: number; teaching?: number; crew?: number };

  function context(held: Held = {}, permissions: string[] = [], superAdmin = false) {
    answers["guardian.count"] = held.guardian ?? 0;
    answers["teachingAssignment.count"] = held.teaching ?? 0;
    answers["vehicle.count"] = held.crew ?? 0;

    return {
      user: {
        id: USER,
        username: "f-2025-0142",
        // Null far more often than not: a guardian handed a portal login at the
        // counter has no address the school knows of — see User.email.
        email: null,
        profile: { firstName: "Nadia", lastName: "Alami" },
      },
      organization: { name: "Groupe Scolaire" },
      currentSchool: { name: "École A" },
      currentSchoolYear: { name: "2025-2026" },
      isSuperAdmin: superAdmin,
      can: (code: string) => permissions.includes(code),
    } as unknown as Parameters<typeof loadMobileIdentity>[0];
  }

  it("offers nothing to an account that is none of the four things", async () => {
    const identity = await loadMobileIdentity(context());
    expect(identity.spaces).toEqual([]);
    expect(identity.defaultSpace).toBeNull();
  });

  it("offers the family space to a guardian, and nothing else", async () => {
    const identity = await loadMobileIdentity(context({ guardian: 1 }));
    expect(identity.spaces).toEqual(["family"]);
    expect(identity.defaultSpace).toBe("family");
  });

  it("counts only active guardianships", async () => {
    await loadMobileIdentity(context({ guardian: 1 }));
    const count = calls.find((call) => call.model === "guardian");
    expect(count?.args["where"]).toMatchObject({ userId: USER, isActive: true });
  });

  it("gives a supply teacher with no assignments yet the teacher space", async () => {
    const identity = await loadMobileIdentity(
      context({}, ["classroom.workspace"]),
    );
    expect(identity.spaces).toContain("teacher");
  });

  it("counts the accompagnateur as crew, not just the driver", async () => {
    await loadMobileIdentity(context({ crew: 1 }));
    const vehicles = calls.find((call) => call.model === "vehicle");
    expect(vehicles?.args["where"]).toMatchObject({
      OR: [{ driver: { userId: USER } }, { attendant: { userId: USER } }],
    });
  });

  it("opens on the richest space a person holds", async () => {
    // A director who also teaches lands on the dashboard, not their own
    // timetable.
    const identity = await loadMobileIdentity(
      context({ guardian: 1, teaching: 1, crew: 1 }, [
        "schoolLife.view",
        "classroom.workspace",
        "transport.attendance",
      ]),
    );

    expect(identity.spaces).toEqual(["family", "teacher", "driver", "director"]);
    expect(identity.defaultSpace).toBe("director");
  });

  it("gives a super admin the director space without naming a permission", async () => {
    const identity = await loadMobileIdentity(context({}, [], true));
    expect(identity.spaces).toEqual(["director"]);
  });

  it("falls back to the username when the profile has no name", async () => {
    // Not to the address: an account may well have none, and the username is
    // what this person types to get here in the first place.
    const bare = context({ guardian: 1 });
    (bare as unknown as { user: { profile: unknown } }).user.profile = null;

    const identity = await loadMobileIdentity(bare);
    expect(identity.fullName).toBe("f-2025-0142");
  });

  it("grants nothing by itself — every endpoint still authorizes", async () => {
    // Documented as a claim in identity.ts, and worth stating in a test: the
    // space list decides what the app *offers*, so an account that lies about
    // its space reaches exactly as much as it could without lying.
    const identity = await loadMobileIdentity(context({ crew: 1 }));
    expect(identity.spaces).toContain("driver");
    // No permission was consulted to reach that, which is precisely why the
    // transport endpoints check TRANSPORT_ATTENDANCE on their own.
    expect(identity).not.toHaveProperty("permissions");
  });
});

// ── Guardianship ─────────────────────────────────────────────────────────────

describe("isGuardian", () => {
  it("asks only about active guardianships held by this account", async () => {
    await portal.isGuardian(USER);

    const count = calls.find((call) => call.model === "guardian");
    expect(count?.op).toBe("count");
    expect(count?.args["where"]).toMatchObject({
      userId: USER,
      isActive: true,
    });
  });

  it("is false when the account is on no dossier", async () => {
    expect(await portal.isGuardian(USER)).toBe(false);
  });

  it("is true as soon as it is on one", async () => {
    answers["guardian.count"] = 1;
    expect(await portal.isGuardian(USER)).toBe(true);
  });
});
