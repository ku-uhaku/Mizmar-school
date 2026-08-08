import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/permissions";
import { getDictionaryFor } from "@/lib/i18n/server";
import {
  EVENT_KINDS,
  EVENT_STATUSES,
  VISIBLE_EVENT_STATUSES,
  endOfDay,
  isCancellable,
  isPublishable,
  isUpcoming,
  isVisibleToFamilies,
  spansDays,
  startOfDay,
} from "@/modules/events/enums";

/**
 * Les annonces: the one thing this app puts in front of every family at once.
 *
 * Three decisions shape it, and each is a rule the server has to hold on its
 * own — the manager is a client component, so what it chooses to draw protects
 * nothing.
 *
 *   * **Drafting and announcing are different acts.** `event.manage` prepares
 *     the réunion de parents; `event.publish` decides it goes out. An event is
 *     always created as a draft.
 *   * **Called off is not deleted.** A réunion cancelled after families were
 *     told has to stay on their screen saying so, or a parent turns up to a
 *     locked gate. That is why CANCELLED is a status and why deleting a
 *     published event is refused.
 *   * **A targeted event may only name this school's own levels and classes.**
 *     The parent query joins on those rows, so a crafted id would deliver an
 *     announcement against a level nobody here teaches.
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
              : op === "updateMany"
                ? { count: 1 }
                : op === "findFirst" || op === "findUnique"
                  ? null
                  : { id: "event-new" };
          },
        },
      );
    },
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
  requireAuth: async () => ({
    organization: { id: "org-1" },
    currentSchool: { id: "school-1" },
    currentSchoolYear: { id: "year-1" },
    user: { id: "user-1" },
    can: (code: string) => granted.has(code),
    canOrg: (code: string) => granted.has(code),
    canInSchool: (_school: string, code: string) => granted.has(code),
  }),
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

const { cancelEvent, createEvent, publishEvent, unpublishEvent } = await import(
  "@/modules/events/service"
);
const { publishEventAction } = await import("@/modules/events/actions");

const of = (model: string, op: string) =>
  calls.filter((call) => call.model === model && call.op === op);

const only = (model: string, op: string) => {
  const matches = of(model, op);
  expect(matches, `${model}.${op}`).toHaveLength(1);
  return matches[0]!;
};

beforeEach(() => {
  calls.length = 0;
  answers = {};
  asked.length = 0;
  granted.clear();
  for (const code of Object.values(PERMISSIONS)) granted.add(code);
});

// ── What a family may see ────────────────────────────────────────────────────

describe("visibility", () => {
  it("shows a family an announcement and a cancellation, never a draft", () => {
    // A draft is being prepared and no family can see it. A cancellation they
    // must see, or somebody turns up to a locked gate.
    expect([...VISIBLE_EVENT_STATUSES]).toEqual(["PUBLISHED", "CANCELLED"]);
    expect(EVENT_STATUSES.filter(isVisibleToFamilies)).toEqual([
      "PUBLISHED",
      "CANCELLED",
    ]);
  });

  it("keeps a draft out of the portal entirely", () => {
    expect(isVisibleToFamilies("DRAFT")).toBe(false);
  });

  it("says no to a status it has never heard of", () => {
    for (const nonsense of ["", "published", "SENT", "__proto__"]) {
      expect(isVisibleToFamilies(nonsense), nonsense).toBe(false);
    }
  });

  it("names a short list of kinds, and a catch-all last", () => {
    // The list exists so a parent's screen can put an icon against a line, not
    // to classify every occasion a school might hold.
    expect(EVENT_KINDS).toContain("MEETING");
    expect(EVENT_KINDS.at(-1)).toBe("OTHER");
  });
});

// ── The state machine ────────────────────────────────────────────────────────

describe("which moves an event may make", () => {
  it("announces a draft and nothing else", () => {
    expect(EVENT_STATUSES.filter(isPublishable)).toEqual(["DRAFT"]);
  });

  it("calls off only something already announced", () => {
    // You cannot cancel what nobody was told about — that is a delete.
    expect(EVENT_STATUSES.filter(isCancellable)).toEqual(["PUBLISHED"]);
  });

  it("never lets a status be both", () => {
    for (const status of EVENT_STATUSES) {
      expect(isPublishable(status) && isCancellable(status), status).toBe(false);
    }
  });
});

// ── Publishing ───────────────────────────────────────────────────────────────

describe("publishEvent", () => {
  const draft = (extra: Record<string, unknown> = {}) => {
    answers = {
      "event.findFirst": {
        id: "event-1",
        status: "DRAFT",
        isSchoolWide: true,
        _count: { audiences: 0 },
        ...extra,
      },
    };
  };

  it("announces a school-wide draft", async () => {
    draft();
    expect(await publishEvent("event-1", "school-1", "user-1")).toEqual({
      ok: true,
    });

    const call = only("event", "updateMany").args as {
      data: Record<string, unknown>;
    };
    expect(call.data["status"]).toBe("PUBLISHED");
    expect(call.data["publishedById"]).toBe("user-1");
    expect(call.data["publishedAt"]).toBeInstanceOf(Date);
  });

  it("refuses to announce a cancelled event again", async () => {
    // The bug this closes. It used to accept anything that was not already
    // published, so a direct POST put a called-off réunion back on families'
    // screens as if it were on — restamping `publishedAt` and erasing the one
    // record CANCELLED exists to keep.
    draft({ status: "CANCELLED" });

    expect(await publishEvent("event-1", "school-1", "user-1")).toEqual({
      ok: false,
      reason: "CANCELLED",
    });
    expect(of("event", "updateMany")).toEqual([]);
  });

  it("refuses one already announced", async () => {
    draft({ status: "PUBLISHED" });
    expect(await publishEvent("event-1", "school-1", "user-1")).toEqual({
      ok: false,
      reason: "ALREADY_PUBLISHED",
    });
    expect(of("event", "updateMany")).toEqual([]);
  });

  it("refuses a targeted event nobody would receive", async () => {
    // A published event nobody can see is always a mistake, never a choice —
    // and a draft saved school-wide may have been narrowed since.
    draft({ isSchoolWide: false, _count: { audiences: 0 } });

    expect(await publishEvent("event-1", "school-1", "user-1")).toEqual({
      ok: false,
      reason: "NO_AUDIENCE",
    });
    expect(of("event", "updateMany")).toEqual([]);
  });

  it("announces a targeted event that still has an audience", async () => {
    draft({ isSchoolWide: false, _count: { audiences: 2 } });
    expect(await publishEvent("event-1", "school-1", "user-1")).toEqual({
      ok: true,
    });
  });

  it("scopes the event by school, never by id alone", async () => {
    draft();
    await publishEvent("event-1", "school-1", "user-1");
    expect(only("event", "findFirst").args).toMatchObject({
      where: { id: "event-1", schoolId: "school-1" },
    });
  });

  it("refuses an event of another school", async () => {
    expect(await publishEvent("event-1", "school-1", "user-1")).toEqual({
      ok: false,
      reason: "NOT_FOUND",
    });
  });

  it("restates the draft as the claim's condition", async () => {
    // Two people pressing Publish at once: the second matches no rows instead
    // of overwriting the first one's stamp.
    draft();
    await publishEvent("event-1", "school-1", "user-1");
    expect(only("event", "updateMany").args).toMatchObject({
      where: { id: "event-1", schoolId: "school-1", status: "DRAFT" },
    });
  });

  it("reports the loser of that race as already published", async () => {
    draft();
    answers["event.updateMany"] = { count: 0 };
    expect(await publishEvent("event-1", "school-1", "user-1")).toEqual({
      ok: false,
      reason: "ALREADY_PUBLISHED",
    });
  });
});

describe("publishEventAction", () => {
  it("asks for the publishing code, not the managing one", async () => {
    granted.clear();
    granted.add(PERMISSIONS.EVENT_MANAGE);

    const state = await publishEventAction("event-1");
    expect(asked).toEqual([PERMISSIONS.EVENT_PUBLISH]);
    expect(state.status).toBe("error");
  });

  it("reports a refused cancellation rather than claiming success", async () => {
    // The switch over the refusal reasons has no default, so a reason it does
    // not name falls through to `success` — telling somebody an event went out
    // when it did not.
    answers = {
      "event.findFirst": {
        id: "event-1",
        status: "CANCELLED",
        isSchoolWide: true,
        _count: { audiences: 0 },
      },
    };

    const state = await publishEventAction("event-1");
    expect(state.status).toBe("error");
    expect(state.message).toBe(t.event.cannotPublishCancelled);
  });

  it("names every reason the service can give it", async () => {
    for (const [status, extra, message] of [
      ["PUBLISHED", {}, t.event.published],
      ["CANCELLED", {}, t.event.cannotPublishCancelled],
      [
        "DRAFT",
        { isSchoolWide: false, _count: { audiences: 0 } },
        t.event.audienceEmpty,
      ],
    ] as const) {
      calls.length = 0;
      answers = {
        "event.findFirst": {
          id: "event-1",
          status,
          isSchoolWide: true,
          _count: { audiences: 0 },
          ...extra,
        },
      };

      const state = await publishEventAction("event-1");
      expect(state.status, status).toBe("error");
      expect(state.message, status).toBe(message);
    }
  });
});

describe("unpublishEvent and cancelEvent", () => {
  it("takes an announced event back to draft, stamp and all", async () => {
    // `publishedAt` never says an event is announced while `status` says it is
    // a draft — the two are one fact.
    expect(await unpublishEvent("event-1", "school-1")).toBe(true);
    expect(only("event", "updateMany").args).toMatchObject({
      where: { id: "event-1", schoolId: "school-1", status: "PUBLISHED" },
      data: { status: "DRAFT", publishedAt: null, publishedById: null },
    });
  });

  it("keeps the stamp when an event is called off", async () => {
    // The event stays visible to the families it was announced to, marked as
    // called off — the whole reason this is not a delete.
    await cancelEvent("event-1", "school-1");
    const data = (only("event", "updateMany").args as {
      data: Record<string, unknown>;
    }).data;

    expect(data["status"]).toBe("CANCELLED");
    expect(data).not.toHaveProperty("publishedAt");
    expect(data).not.toHaveProperty("publishedById");
  });

  it("calls off only what was announced", async () => {
    await cancelEvent("event-1", "school-1");
    expect(only("event", "updateMany").args).toMatchObject({
      where: { status: "PUBLISHED" },
    });
  });

  it("refuses to un-publish something that was called off", async () => {
    // A cancellation is not undone by taking the event back to draft either.
    await unpublishEvent("event-1", "school-1");
    expect(only("event", "updateMany").args).toMatchObject({
      where: { status: "PUBLISHED" },
    });
  });

  it("reports nothing moved when it matched nothing", async () => {
    answers = { "event.updateMany": { count: 0 } };
    expect(await unpublishEvent("event-1", "school-1")).toBe(false);
    calls.length = 0;
    expect(await cancelEvent("event-1", "school-1")).toBe(false);
  });
});

// ── The audience ─────────────────────────────────────────────────────────────

const input = (extra: Record<string, unknown> = {}) => ({
  schoolId: "school-1",
  schoolYearId: "year-1",
  title: "Réunion de parents",
  titleAr: null,
  description: null,
  kind: "MEETING",
  startsAt: new Date(2026, 2, 12, 14, 30),
  endsAt: null,
  isAllDay: false,
  location: null,
  isSchoolWide: true,
  audience: { levelIds: [], classIds: [] },
  ...extra,
}) as Parameters<typeof createEvent>[0];

describe("createEvent", () => {
  it("always creates a draft, whatever it was asked for", async () => {
    // Publishing is a separate decision, behind a separate code.
    await createEvent(input({ status: "PUBLISHED" } as never), "user-1");
    const data = (only("event", "create").args as {
      data: Record<string, unknown>;
    }).data;
    expect(data["status"]).toBe("DRAFT");
  });

  it("takes no audience at all for a school-wide event", async () => {
    await createEvent(
      input({
        isSchoolWide: true,
        audience: { levelIds: ["level-1"], classIds: ["class-1"] },
      }),
      "user-1",
    );

    const data = (only("event", "create").args as {
      data: { audiences: { create: unknown[] } };
    }).data;
    expect(data.audiences.create).toEqual([]);
    // And does not go looking for ids it will not use.
    expect(of("level", "findMany")).toEqual([]);
  });

  it("re-derives a targeted audience against this school", async () => {
    // A crafted `levelId` would attach another school's level, and the parent
    // query joins on exactly these rows.
    answers = {
      "level.findMany": [{ id: "level-1" }],
      "schoolClass.findMany": [{ id: "class-1" }],
    };
    await createEvent(
      input({
        isSchoolWide: false,
        audience: { levelIds: ["level-1", "level-elsewhere"], classIds: ["class-1"] },
      }),
      "user-1",
    );

    expect(only("level", "findMany").args).toMatchObject({
      where: { id: { in: ["level-1", "level-elsewhere"] }, schoolId: "school-1" },
    });
    expect(only("schoolClass", "findMany").args).toMatchObject({
      where: { schoolId: "school-1", levelOffering: { schoolYearId: "year-1" } },
    });
  });

  it("drops what does not survive rather than refusing the lot", async () => {
    // The screen only ever offers reachable ids, so a dropped one is an attack
    // and not a typo worth explaining.
    answers = { "level.findMany": [{ id: "level-1" }], "schoolClass.findMany": [] };
    await createEvent(
      input({
        isSchoolWide: false,
        audience: { levelIds: ["level-1", "level-elsewhere"], classIds: ["class-elsewhere"] },
      }),
      "user-1",
    );

    const data = (only("event", "create").args as {
      data: { audiences: { create: Record<string, unknown>[] } };
    }).data;
    expect(data.audiences.create).toEqual([{ levelId: "level-1" }]);
  });

  it("snaps an all-day event to the day rather than to the hour it was saved", async () => {
    // "Le 12 mars" is stored as the 12th at 00:00, not as whatever o'clock the
    // secretary happened to press save at.
    await createEvent(
      input({
        isAllDay: true,
        startsAt: new Date(2026, 2, 12, 16, 45),
        endsAt: new Date(2026, 2, 14, 9, 15),
      }),
      "user-1",
    );

    const data = (only("event", "create").args as {
      data: { startsAt: Date; endsAt: Date };
    }).data;
    expect(data.startsAt.getHours()).toBe(0);
    expect(data.startsAt.getDate()).toBe(12);
    expect(data.endsAt.getHours()).toBe(23);
    expect(data.endsAt.getDate()).toBe(14);
  });

  it("leaves a timed event's clock alone", async () => {
    await createEvent(input({ isAllDay: false }), "user-1");
    const data = (only("event", "create").args as {
      data: { startsAt: Date };
    }).data;
    expect(data.startsAt.getHours()).toBe(14);
  });
});

// ── The dates ────────────────────────────────────────────────────────────────

describe("the day helpers", () => {
  it("reads a day in local time, not in UTC", () => {
    // Morocco is ahead of UTC, and an event stored against the wrong day is one
    // a parent turns up to on the wrong morning.
    const day = startOfDay(new Date(2026, 2, 12, 23, 30));
    expect(day.getDate()).toBe(12);
    expect(day.getHours()).toBe(0);
  });

  it("closes a day on its last instant", () => {
    const end = endOfDay(new Date(2026, 2, 12, 0, 1));
    expect(end.getHours()).toBe(23);
    expect(end.getMilliseconds()).toBe(999);
  });

  it("does not mutate what it was given", () => {
    const original = new Date(2026, 2, 12, 16, 45);
    startOfDay(original);
    endOfDay(original);
    expect(original.getHours()).toBe(16);
  });

  it("keeps a multi-day outing upcoming on its second morning", () => {
    // Reading `endsAt` rather than `startsAt` is what stops a three-day sortie
    // dropping off a parent's screen the moment it begins.
    const outing = {
      startsAt: new Date(2026, 2, 12),
      endsAt: new Date(2026, 2, 14),
    };
    expect(isUpcoming(outing, new Date(2026, 2, 13))).toBe(true);
    expect(isUpcoming(outing, new Date(2026, 2, 15))).toBe(false);
  });

  it("falls back to the start for an event with no end", () => {
    const meeting = { startsAt: new Date(2026, 2, 12, 14), endsAt: null };
    expect(isUpcoming(meeting, new Date(2026, 2, 12, 13))).toBe(true);
    expect(isUpcoming(meeting, new Date(2026, 2, 12, 15))).toBe(false);
  });

  it("knows when an event runs past its own day", () => {
    expect(
      spansDays({ startsAt: new Date(2026, 2, 12, 8), endsAt: new Date(2026, 2, 12, 18) }),
    ).toBe(false);
    expect(
      spansDays({ startsAt: new Date(2026, 2, 12), endsAt: new Date(2026, 2, 14) }),
    ).toBe(true);
    expect(
      spansDays({ startsAt: new Date(2026, 2, 12), endsAt: null }),
    ).toBe(false);
  });
});
