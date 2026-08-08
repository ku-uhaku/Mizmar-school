import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDictionaryFor } from "@/lib/i18n/server";

/**
 * The header's school and year switcher.
 *
 * Seventy-one lines, and load-bearing out of all proportion to that: almost
 * every read in the app scopes on `context.currentSchool`, so whatever this
 * writes decides what the next request can see. Two things follow.
 *
 * **The context lives on the User row, not in a cookie.** It cannot be forged
 * by the client and it follows the user between devices — which also means the
 * only way to move it is through these two actions, and both re-derive what the
 * user may reach from the session rather than believing the id they were sent.
 *
 * **Switching school moves the year with it.** Keeping a year that belongs to
 * the school just left would leave every year-scoped read pointing at nothing,
 * which reads on screen as a school with no data rather than as a mistake.
 */

const t = getDictionaryFor("en");

// ─────────────────────────────────────────────────────────────────────────────

const writes: { where: unknown; data: Record<string, unknown> }[] = [];
const yearLookups: unknown[] = [];

/** The schools this session may reach — the DAL's own answer, faked. */
let reachable: { id: string; name: string }[] = [];
let currentSchool: { id: string } | null = null;
/** Years belonging to the school in context. */
let yearsOfCurrentSchool: string[] = [];
/** What `defaultSchoolYearFor` answers for a school. */
let defaultYears: Record<string, string | null> = {};

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      update: async (args: {
        where: unknown;
        data: Record<string, unknown>;
      }) => {
        writes.push(args);
        return {};
      },
    },
    schoolYear: {
      findFirst: async (args: {
        where: { id?: string; schoolId?: string };
      }) => {
        yearLookups.push(args);
        const { id, schoolId } = args.where;
        return id &&
          schoolId === currentSchool?.id &&
          yearsOfCurrentSchool.includes(id)
          ? { id }
          : null;
      },
    },
  },
  auditClient: {},
}));

vi.mock("@/lib/audit", () => ({ recordEvent: async () => {} }));

vi.mock("@/modules/school-years/queries", () => ({
  defaultSchoolYearFor: async (schoolId: string) => {
    const id = defaultYears[schoolId];
    return id ? { id } : null;
  },
}));

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
    user: { id: "user-1" },
    schools: reachable,
    currentSchool,
    currentSchoolYear: null,
    can: () => true,
    canOrg: () => true,
    canInSchool: () => true,
  }),
}));

vi.mock("@/lib/i18n/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/server")>()),
  getDictionary: async () => t,
}));

vi.mock("next/cache", () => ({ refresh: () => {} }));

const { switchSchoolAction, switchSchoolYearAction } = await import(
  "@/modules/context/actions"
);

beforeEach(() => {
  writes.length = 0;
  yearLookups.length = 0;
  reachable = [
    { id: "school-1", name: "Al Massira" },
    { id: "school-2", name: "Ibn Batouta" },
  ];
  currentSchool = { id: "school-1" };
  yearsOfCurrentSchool = ["year-1", "year-2"];
  defaultYears = { "school-1": "year-1", "school-2": "year-9" };
});

// ── Switching school ─────────────────────────────────────────────────────────

describe("switchSchoolAction", () => {
  it("moves the context to a school the user can reach", async () => {
    const state = await switchSchoolAction("school-2");

    expect(state.status).toBe("success");
    expect(writes[0]).toMatchObject({
      where: { id: "user-1" },
      data: { currentSchoolId: "school-2" },
    });
  });

  it("refuses a school the user cannot reach", async () => {
    // Never trust the id from the client. This is the whole action: almost
    // every read in the app scopes on the school it writes, so accepting an id
    // here would be accepting it everywhere.
    const state = await switchSchoolAction("school-9");

    expect(state.status).toBe("error");
    expect(state.message).toBe(t.errors.forbidden);
    expect(writes).toEqual([]);
  });

  it("refuses one the user has just lost access to", async () => {
    // The reachable set is rebuilt from the database on every request, so a
    // membership revoked a second ago is already gone from it.
    reachable = [{ id: "school-1", name: "Al Massira" }];
    const state = await switchSchoolAction("school-2");

    expect(state.status).toBe("error");
    expect(writes).toEqual([]);
  });

  it("refuses when the user can reach no school at all", async () => {
    reachable = [];
    expect((await switchSchoolAction("school-1")).status).toBe("error");
    expect(writes).toEqual([]);
  });

  it("moves the year to one belonging to the new school", async () => {
    // Keeping a year from the school just left would point every year-scoped
    // read at nothing, which reads on screen as a school with no data.
    await switchSchoolAction("school-2");
    expect(writes[0]!.data["currentSchoolYearId"]).toBe("year-9");
  });

  it("clears the year when the new school has none", async () => {
    // A school created this morning. Null is the honest answer, and every
    // `yearScope` read already falls back to matching nothing.
    defaultYears = { "school-2": null };
    await switchSchoolAction("school-2");
    expect(writes[0]!.data["currentSchoolYearId"]).toBeNull();
  });

  it("writes the id it resolved, not the one it was handed", async () => {
    // Belt and braces: the reachable entry is what is written, so the two can
    // never disagree.
    await switchSchoolAction("school-2");
    expect(writes[0]!.data["currentSchoolId"]).toBe("school-2");
  });

  it("writes against the signed-in user and nobody else", async () => {
    await switchSchoolAction("school-2");
    expect(writes[0]!.where).toEqual({ id: "user-1" });
  });

  it("touches nothing but the working context", async () => {
    await switchSchoolAction("school-2");
    expect(Object.keys(writes[0]!.data).sort()).toEqual([
      "currentSchoolId",
      "currentSchoolYearId",
    ]);
  });
});

// ── Switching year ───────────────────────────────────────────────────────────

describe("switchSchoolYearAction", () => {
  it("moves the context to a year of the school in context", async () => {
    const state = await switchSchoolYearAction("year-2");

    expect(state.status).toBe("success");
    expect(writes[0]).toMatchObject({
      where: { id: "user-1" },
      data: { currentSchoolYearId: "year-2" },
    });
  });

  it("looks the year up under the school in context, never the request", async () => {
    await switchSchoolYearAction("year-2");
    expect(yearLookups[0]).toMatchObject({
      where: { id: "year-2", schoolId: "school-1" },
    });
  });

  it("refuses a year belonging to another school", async () => {
    // The year id is guessable and a year carries no school of its own on the
    // wire, so this is the only thing standing between a switch and reading
    // another school's calendar.
    const state = await switchSchoolYearAction("year-of-school-2");

    expect(state.status).toBe("error");
    expect(state.message).toBe(t.errors.forbidden);
    expect(writes).toEqual([]);
  });

  it("refuses a year nobody declared", async () => {
    expect((await switchSchoolYearAction("nowhere")).status).toBe("error");
    expect(writes).toEqual([]);
  });

  it("refuses with no school in context", async () => {
    // There is nothing to scope the year against, so there is nothing to
    // accept it on.
    currentSchool = null;
    const state = await switchSchoolYearAction("year-1");

    expect(state.status).toBe("error");
    expect(state.message).toBe(t.errors.noSchoolContext);
    expect(yearLookups).toEqual([]);
    expect(writes).toEqual([]);
  });

  it("leaves the school alone", async () => {
    await switchSchoolYearAction("year-2");
    expect(writes[0]!.data).not.toHaveProperty("currentSchoolId");
    expect(Object.keys(writes[0]!.data)).toEqual(["currentSchoolYearId"]);
  });

  it("writes against the signed-in user and nobody else", async () => {
    await switchSchoolYearAction("year-2");
    expect(writes[0]!.where).toEqual({ id: "user-1" });
  });
});
