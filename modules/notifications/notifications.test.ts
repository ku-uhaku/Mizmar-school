import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDictionaryFor } from "@/lib/i18n/server";
import {
  BADGE_CAP,
  KIND_TONES,
  NOTIFICATION_KINDS,
  dedupeKeyFor,
  isNotificationKind,
  readParams,
  webHref,
} from "@/modules/notifications/enums";

/**
 * L'inbox: the one screen in the app whose scope is an account rather than a
 * school, and the one write path that is allowed to fail quietly.
 *
 * Four decisions shape it, and each is a rule no screen can hold on its own:
 *
 *   * **Nothing user-facing is stored.** A row carries a `kind` and the proper
 *     nouns to drop into it, so the same notification reads in French at the
 *     desk and in Arabic on the phone. Storing the sentence would freeze it in
 *     whatever language the *writer* happened to hold.
 *   * **The account is the scope.** Every read and every write puts the
 *     session's `userId` in the `where`, so an id from a request reaches
 *     nothing that is not already the caller's.
 *   * **Telling somebody must never undo the thing they are being told about.**
 *     `dispatch` swallows, because the payment is taken and the bulletin is out
 *     by the time it runs.
 *   * **Saying it twice is saying it once.** `dedupeKey` is what makes publish
 *     → unpublish → publish one line rather than three — except where repeating
 *     is the point, which is money.
 */

const t = getDictionaryFor("en");

// ─────────────────────────────────────────────────────────────────────────────

const calls: { model: string; op: string; args: unknown }[] = [];
let answers: Record<string, unknown> = {};

const db = new Proxy(
  {},
  {
    get: (_target, model: string) => {
      if (model === "$transaction") {
        return async (work: unknown) =>
          typeof work === "function"
            ? (work as (tx: unknown) => unknown)(db)
            : Promise.all(work as unknown[]);
      }
      return new Proxy(
        {},
        {
          get: (_d, op: string) => async (args: unknown) => {
            calls.push({ model, op, args });
            const key = `${model}.${op}`;
            if (key in answers) return answers[key];
            return op === "findMany"
              ? []
              : op === "count"
                ? 0
                : op === "createMany"
                  ? { count: 0 }
                  : op === "updateMany"
                    ? { count: 1 }
                    : op === "findFirst" || op === "findUnique"
                      ? null
                      : { id: "notification-new" };
          },
        },
      );
    },
  },
);

vi.mock("@/lib/db", () => ({ db, auditClient: {} }));
vi.mock("@/lib/audit", () => ({ recordEvent: async () => {} }));

const {
  dispatch,
  guardiansOf,
  guardiansOfClass,
  guardiansOfFamily,
  notify,
  staffAccount,
  staffHolding,
} = await import("@/modules/notifications/service");

const { listInbox, unreadCount } = await import(
  "@/modules/notifications/queries"
);

const { describeNotification } = await import(
  "@/modules/notifications/describe"
);

const of = (model: string, op: string) =>
  calls.filter((call) => call.model === model && call.op === op);

const context = {
  user: { id: "user-1" },
  organization: { id: "org-1" },
} as unknown as Parameters<typeof listInbox>[0];

beforeEach(() => {
  calls.length = 0;
  answers = {};
});

// ─────────────────────────────────────────────────────────────────────────────

describe("the catalogue", () => {
  it("gives every kind a tone, so no surface has to invent one", () => {
    for (const kind of NOTIFICATION_KINDS) {
      expect(KIND_TONES[kind], kind).toBeDefined();
    }
  });

  it("gives every kind a phrase in the canonical dictionary", () => {
    for (const kind of NOTIFICATION_KINDS) {
      expect(t.notification.kinds[kind], kind).toBeTruthy();
    }
  });

  it("rejects a kind the running code has never heard of", () => {
    expect(isNotificationKind("EVENT_PUBLISHED")).toBe(true);
    expect(isNotificationKind("SOMETHING_NEWER")).toBe(false);
  });

  it("sends nobody to a dashboard screen a guardian cannot open", () => {
    // Every family-facing kind must answer null: a parent holds no membership,
    // so a href here would be a link to the forbidden state.
    for (const kind of [
      "EVENT_PUBLISHED",
      "REQUEST_HANDLED",
      "MARKS_PUBLISHED",
      "BULLETIN_PUBLISHED",
      "REMARK_SHARED",
      "PAYMENT_RECORDED",
    ]) {
      expect(webHref(kind, { subjectId: "x" }), kind).toBeNull();
    }

    expect(webHref("REQUEST_FILED", { subjectId: "req-1" })).toBe("/requests");
    expect(webHref("ASSESSMENT_VALIDATED", { subjectId: "a-1" })).toBe(
      "/assessments/a-1",
    );
  });
});

describe("dedupe keys", () => {
  it("collapses a republished event into one line", () => {
    expect(dedupeKeyFor("EVENT_PUBLISHED", "event-1")).toBe(
      "EVENT_PUBLISHED:event-1",
    );
  });

  it("keeps each move of a dossier apart", () => {
    // Keyed on the id alone, only the first of accepted → ready → collected
    // would ever be delivered.
    const accepted = dedupeKeyFor("REQUEST_HANDLED", "req-1", "ACCEPTED");
    const ready = dedupeKeyFor("REQUEST_HANDLED", "req-1", "READY");
    expect(accepted).not.toBe(ready);
  });

  it("never collapses two payments", () => {
    // Two settlements on one day are two receipts, and hiding one hides money
    // the family actually paid.
    expect(dedupeKeyFor("PAYMENT_RECORDED", "payment-1")).toBeNull();
  });

  it("never collapses a resubmitted list", () => {
    // Refused, corrected, handed up again: the office has dealt with the first
    // version and needs telling about the second.
    expect(dedupeKeyFor("SUPPLY_LIST_SUBMITTED", "list-1")).toBeNull();
  });

  it("keeps two lessons missed on the same day apart", () => {
    // Missing maths and missing history are two absences. The scope key is what
    // tells them apart, and one key per day would collapse them into whichever
    // register was taken first.
    const maths = dedupeKeyFor("ATTENDANCE_MISSED", "enrol-1", "2026-03-04:slot-1");
    const history = dedupeKeyFor("ATTENDANCE_MISSED", "enrol-1", "2026-03-04:slot-2");
    expect(maths).not.toBe(history);
  });
});

describe("params", () => {
  it("survives anything that is not an object", () => {
    // One bad row must not take down the whole inbox.
    expect(readParams("not json")).toEqual({});
    expect(readParams("[1,2]")).toEqual({});
    expect(readParams("null")).toEqual({});
  });

  it("stringifies whatever it was given", () => {
    expect(readParams('{"count":3}')).toEqual({ count: "3" });
  });
});

describe("notify", () => {
  it("writes one row per recipient", async () => {
    await notify({
      organizationId: "org-1",
      schoolId: "school-1",
      kind: "PAYMENT_RECORDED",
      subjectId: "payment-1",
      params: { code: "REC-1" },
      targets: [{ userId: "user-1" }, { userId: "user-2" }],
    });

    const created = of("notification", "createMany")[0]!;
    expect((created.args as { data: unknown[] }).data).toHaveLength(2);
  });

  it("hands the same person one line, not two", async () => {
    // A guardian of two children in the same class is one reader.
    await notify({
      organizationId: "org-1",
      schoolId: "school-1",
      kind: "PAYMENT_RECORDED",
      subjectId: "payment-1",
      targets: [
        { userId: "user-1", studentId: "child-1" },
        { userId: "user-1", studentId: "child-2" },
      ],
    });

    const created = of("notification", "createMany")[0]!;
    expect((created.args as { data: unknown[] }).data).toHaveLength(1);
  });

  it("upserts a deduplicated kind so a republish tells nobody twice", async () => {
    await notify({
      organizationId: "org-1",
      schoolId: "school-1",
      kind: "EVENT_PUBLISHED",
      subjectId: "event-1",
      params: { title: "Réunion" },
      targets: [{ userId: "user-1" }],
    });

    const upsert = of("notification", "upsert")[0]!;
    expect(upsert.args).toMatchObject({
      where: {
        userId_dedupeKey: {
          userId: "user-1",
          dedupeKey: "EVENT_PUBLISHED:event-1",
        },
      },
      // Empty on purpose: a line already read must not come back unread.
      update: {},
    });
  });

  it("merges a target's own params over the shared ones", async () => {
    await notify({
      organizationId: "org-1",
      schoolId: "school-1",
      kind: "PAYMENT_RECORDED",
      subjectId: "payment-1",
      params: { code: "REC-1" },
      targets: [{ userId: "user-1", params: { child: "Yasmine" } }],
    });

    const created = of("notification", "createMany")[0]!;
    const row = (created.args as { data: { params: string }[] }).data[0]!;
    expect(readParams(row.params)).toEqual({ code: "REC-1", child: "Yasmine" });
  });

  it("writes nothing when nobody is reachable", async () => {
    const written = await notify({
      organizationId: "org-1",
      schoolId: "school-1",
      kind: "EVENT_PUBLISHED",
      subjectId: "event-1",
      targets: [],
    });

    expect(written).toBe(0);
    expect(of("notification", "createMany")).toEqual([]);
    expect(of("notification", "upsert")).toEqual([]);
  });
});

describe("dispatch", () => {
  it("never lets a fan-out reach the caller", async () => {
    // The whole point: the payment is taken and the bulletin is out by the time
    // this runs, so a failure here must not roll either of them back.
    await expect(
      dispatch("TEST", async () => {
        throw new Error("the database went away");
      }),
    ).resolves.toBeUndefined();
  });
});

describe("who gets told", () => {
  it("skips a guardian with no account to read with", async () => {
    answers["student.findMany"] = [
      {
        id: "child-1",
        firstName: "Yasmine",
        lastName: "Alami",
        // The commonest case by far: a name and a phone number on the dossier.
        family: { guardians: [] },
      },
    ];

    expect(await guardiansOf(["child-1"])).toEqual([]);
  });

  it("carries the child's name so the line can say whose mark it is", async () => {
    answers["student.findMany"] = [
      {
        id: "child-1",
        firstName: "Yasmine",
        lastName: "Alami",
        family: { guardians: [{ userId: "user-9" }] },
      },
    ];

    expect(await guardiansOf(["child-1"])).toEqual([
      {
        userId: "user-9",
        studentId: "child-1",
        params: { child: "Yasmine Alami" },
      },
    ]);
  });

  it("tolerates a pupil with no dossier familial yet", async () => {
    answers["student.findMany"] = [
      { id: "child-1", firstName: "A", lastName: "B", family: null },
    ];

    expect(await guardiansOf(["child-1"])).toEqual([]);
  });

  it("asks for nobody when there are no pupils", async () => {
    expect(await guardiansOf([])).toEqual([]);
    expect(of("student", "findMany")).toEqual([]);
  });

  it("names no child on a family-level receipt", async () => {
    answers["guardian.findMany"] = [{ userId: "user-9" }];
    // A payment can settle three children's schedules at once, so picking one
    // to name would say the wrong thing.
    expect(await guardiansOfFamily("family-1")).toEqual([
      { userId: "user-9" },
    ]);
  });

  it("reaches nobody for a member of staff with no account", async () => {
    // Most of a payroll never signs in — see the note on `Staff.userId`. That
    // is silence, not a failure.
    answers["staff.findUnique"] = { userId: null, user: null };
    expect(await staffAccount("staff-1")).toEqual([]);
  });

  it("skips a member of staff whose account was deactivated", async () => {
    answers["staff.findUnique"] = { userId: "user-9", user: { isActive: false } };
    expect(await staffAccount("staff-1")).toEqual([]);
  });

  it("reaches a member of staff who does have a live account", async () => {
    answers["staff.findUnique"] = { userId: "user-9", user: { isActive: true } };
    expect(await staffAccount("staff-1")).toEqual([{ userId: "user-9" }]);
  });

  it("narrows a class fan-out to the group when there is one", async () => {
    // A devoir set for the TP half is sat by half the class; telling the other
    // half is telling them something untrue.
    await guardiansOfClass("class-1", "group-1");
    expect(of("enrollment", "findMany")[0]!.args).toMatchObject({
      where: { schoolClassId: "class-1", classGroupId: "group-1" },
    });
  });

  it("resolves the desk exactly as the DAL resolves a permission", async () => {
    await staffHolding("org-1", "school-1", "request.handle");

    expect(of("user", "findMany")[0]!.args).toMatchObject({
      where: {
        organizationId: "org-1",
        // A leaver's inbox stops filling the day they go.
        isActive: true,
        OR: [
          { isSuperAdmin: true },
          {
            orgRole: {
              permissions: { some: { permission: { code: "request.handle" } } },
            },
          },
          {
            memberships: {
              some: {
                schoolId: "school-1",
                role: {
                  permissions: {
                    some: { permission: { code: "request.handle" } },
                  },
                },
              },
            },
          },
        ],
      },
    });
  });
});

describe("reading the inbox", () => {
  it("scopes every read on the account and the tenant", async () => {
    await listInbox(context);

    expect(of("notification", "findMany")[0]!.args).toMatchObject({
      where: { userId: "user-1", organizationId: "org-1" },
      orderBy: [{ createdAt: "desc" }],
    });
  });

  it("counts only what is unread", async () => {
    await unreadCount(context);

    expect(of("notification", "count")[0]!.args).toMatchObject({
      where: { userId: "user-1", organizationId: "org-1", readAt: null },
    });
  });

  it("drops a row whose kind this build has never heard of", async () => {
    answers["notification.findMany"] = [
      {
        id: "n-1",
        kind: "SOMETHING_NEWER",
        params: "{}",
        subjectId: null,
        studentId: null,
        readAt: null,
        createdAt: new Date(),
      },
    ];

    // A rolled-back deployment, rendered as nothing rather than as a line with
    // no words in it.
    expect(await listInbox(context)).toEqual([]);
  });

  it("shapes a row into the DTO both clients read", async () => {
    const createdAt = new Date("2026-03-04T09:00:00.000Z");
    answers["notification.findMany"] = [
      {
        id: "n-1",
        kind: "REQUEST_FILED",
        params: '{"document":"Attestation","child":"Yasmine"}',
        subjectId: "req-1",
        studentId: "child-1",
        readAt: null,
        createdAt,
      },
    ];

    expect(await listInbox(context)).toEqual([
      {
        id: "n-1",
        kind: "REQUEST_FILED",
        params: { document: "Attestation", child: "Yasmine" },
        subjectId: "req-1",
        studentId: "child-1",
        tone: KIND_TONES.REQUEST_FILED,
        href: "/requests",
        isRead: false,
        createdAt: createdAt.toISOString(),
      },
    ]);
  });
});

describe("wording a notification", () => {
  const item = (
    kind: (typeof NOTIFICATION_KINDS)[number],
    params: Record<string, string>,
  ) =>
    ({
      id: "n-1",
      kind,
      params,
      subjectId: null,
      studentId: null,
      tone: KIND_TONES[kind],
      href: null,
      isRead: false,
      createdAt: "2026-03-04T09:00:00.000Z",
    }) as Parameters<typeof describeNotification>[0];

  it("drops the proper nouns into the phrase", () => {
    expect(
      describeNotification(item("EVENT_PUBLISHED", { title: "Réunion" }), t, "en"),
    ).toBe("New event: Réunion");
  });

  it("never spells one status in another module's words", () => {
    /*
      The trap the vocabulary map exists for. "APPROVED" is a supply list the
      office agreed to buy, a congé the directrice granted, and an avance the
      payroll signed off — three different words in French, three in Arabic, and
      one merged map would render whichever module was declared last. The bug
      would show as a single wrong word in a sentence that otherwise reads
      perfectly, which is the kind nobody reports.
    */
    const spelling = (kind: (typeof NOTIFICATION_KINDS)[number]) =>
      describeNotification(
        item(kind, {
          child: "Sara",
          title: "L", teacher: "T", amountCentimes: "1000",
          date: "2026-03-04T00:00:00.000Z",
          status: "APPROVED",
        }),
        t,
        "en",
      );

    expect(spelling("SUPPLY_LIST_REVIEWED")).toContain(
      t.supplyOptions.statuses.APPROVED,
    );
    expect(spelling("LEAVE_DECIDED")).toContain(
      t.hrOptions.leaveStatuses.APPROVED,
    );
    expect(spelling("ADVANCE_DECIDED")).toContain(
      t.hrOptions.advanceStatuses.APPROVED,
    );
  });

  it("reads `status` in the right vocabulary for the kind", () => {
    /*
      The trap this guards. Both a dossier and a register carry a `status`, and
      the two vocabularies share no values — one map for both would render an
      attendance state through the requests module's labels, and the first
      school to add a status to either would find the other one wrong.
    */
    const register = describeNotification(
      item("ATTENDANCE_MISSED", {
        child: "Sara",
        status: "ABSENT",
        date: "2026-03-04T00:00:00.000Z",
      }),
      t,
      "en",
    );

    expect(register).toContain(t.classroomOptions.attendanceStatuses.ABSENT);
    expect(register).not.toContain(t.requestOptions.statuses.PENDING);
  });

  it("formats a date in the reader's locale, not the teacher's", () => {
    const line = describeNotification(
      item("ASSESSMENT_SCHEDULED", {
        child: "Sara",
        title: "Contrôle n°1",
        subject: "Mathématiques",
        date: "2026-03-04T00:00:00.000Z",
      }),
      t,
      "en",
    );

    // Whatever the locale chooses, never the raw ISO string.
    expect(line).not.toContain("2026-03-04T00:00:00.000Z");
    expect(line).toContain("Contrôle n°1");
  });

  it("words a status from the requests module rather than a copy of it", () => {
    // A school renaming a status must not leave two spellings in the app.
    expect(
      describeNotification(
        item("REQUEST_HANDLED", { document: "Attestation", status: "READY" }),
        t,
        "en",
      ),
    ).toBe(`Attestation: ${t.requestOptions.statuses.READY}`);
  });

  it("formats money in the reader's locale, not the cashier's", () => {
    const line = describeNotification(
      item("PAYMENT_RECORDED", { amountCentimes: "120000", code: "REC-1" }),
      t,
      "en",
    );

    expect(line).toContain("REC-1");
    // 120000 centimes is 1200, however the locale chooses to group it.
    expect(line).toMatch(/1.200/);
  });

  it("leaves a missing slot legible rather than throwing", () => {
    // A row that predates a kind's parameters still has to render.
    expect(describeNotification(item("EVENT_PUBLISHED", {}), t, "en")).toBe(
      "New event: {title}",
    );
  });
});

describe("the badge", () => {
  it("stops counting where a number stops being read", () => {
    expect(BADGE_CAP).toBe(99);
  });
});
