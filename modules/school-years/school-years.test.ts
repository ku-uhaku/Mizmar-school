import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/permissions";
import { getDictionaryFor } from "@/lib/i18n/server";
import {
  SCHOOL_YEAR_STATUSES,
  TERM_NUMBER_MAX,
  TERM_STATUSES,
  TERMS_PER_YEAR_DEFAULT,
  YEAR_COPY_PARTS,
  shiftInDays,
} from "@/modules/school-years/enums";

/**
 * L'année scolaire: the row thirteen tables hang off.
 *
 * `SchoolYear` is the widest cascade in the schema — enrolments, terms, time
 * slots, holidays, weeks, fee rates, discounts, level offerings, transport
 * routes and schedules, chat channels, supply lists and events all disappear
 * with it. Two consequences shape everything below.
 *
 * **Deleting one is not an ordinary delete.** A year that ran holds a school's
 * whole vie scolaire for that year, and the honest end of it is CLOSED, not
 * removed.
 *
 * **Starting one is a copy, not a fresh start.** A school does not redraw its
 * classes and its price list every September, so a new year inherits four
 * groups of configuration — and never a person. What a year holds about people
 * is that year's own business, and copying it is how a September starts out
 * quietly wrong.
 */

const t = getDictionaryFor("en");

// ─────────────────────────────────────────────────────────────────────────────

const calls: { model: string; op: string; args: unknown }[] = [];
let answers: Record<string, unknown> = {};

const db = new Proxy(
  {},
  {
    get: (_target, model: string) =>
      new Proxy(
        {},
        {
          get: (_d, op: string) => async (args: unknown) => {
            calls.push({ model, op, args });
            const key = `${model}.${op}`;
            if (key in answers) return answers[key];
            return op === "count"
              ? 0
              : op === "findMany"
                ? []
                : op === "updateMany"
                  ? { count: 0 }
                  : op === "findUnique" || op === "findFirst"
                    ? null
                    : {};
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

// The copy fans out to four modules; this file is about the orchestration.
vi.mock("@/modules/billing/service", () => ({
  copyFeeConfiguration: async () => ({ rates: 3, discounts: 1 }),
}));
vi.mock("@/modules/classes/service", () => ({
  copyClassStructure: async () => ({ offerings: 4, classes: 8, groups: 2 }),
}));
vi.mock("@/modules/transport/service", () => ({
  copyTransportConfiguration: async () => ({
    schedules: 2,
    routes: 3,
    stops: 9,
  }),
}));

const copiedInOrder: string[] = [];
vi.mock("@/modules/timetable/service", () => ({
  copyTimeSlots: async () => {
    copiedInOrder.push("slots");
    return 12;
  },
  copyHolidays: async () => {
    copiedInOrder.push("holidays");
    return 5;
  },
  generateSchoolWeeks: async () => {
    copiedInOrder.push("weeks");
    return { written: 40 };
  },
}));

const { clearOtherDefaultYears, copyYearConfiguration, makeDefaultYear } =
  await import("@/modules/school-years/service");
const { deleteSchoolYearAction, setDefaultSchoolYearAction } = await import(
  "@/modules/school-years/actions"
);

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
  copiedInOrder.length = 0;
  asked.length = 0;
  granted.clear();
  for (const code of Object.values(PERMISSIONS)) granted.add(code);
});

// ── Deleting a year ──────────────────────────────────────────────────────────

describe("deleteSchoolYearAction", () => {
  const year = () => {
    answers = { "schoolYear.findUnique": { schoolId: "school-1" } };
  };

  it("refuses a year that has pupils on it", async () => {
    // The bug this closes. Thirteen tables cascade from SchoolYear and
    // `Enrollment` is one of them, dragging `EnrollmentFee` behind it — so one
    // button took every inscription and every échéancier of that year, with
    // nothing asked.
    year();
    answers["enrollment.count"] = 312;

    const state = await deleteSchoolYearAction("year-1");
    expect(state.status).toBe("error");
    expect(state.message).toContain("312");
    expect(of("schoolYear", "delete")).toEqual([]);
  });

  it("counts the pupils of that year and no other", async () => {
    year();
    await deleteSchoolYearAction("year-1");
    expect(only("enrollment", "count").args).toMatchObject({
      where: { schoolYearId: "year-1" },
    });
  });

  it("refuses a year money has been collected against", async () => {
    // `Payment.schoolYearId` is a Restrict, so the database was already saying
    // no — as a raw constraint error, which reaches a bursar as "something went
    // wrong" and tells them nothing. And it is not covered by the count above:
    // a year can hold receipts whose inscriptions were since removed.
    year();
    answers["payment.count"] = 57;

    const state = await deleteSchoolYearAction("year-1");
    expect(state.status).toBe("error");
    expect(state.message).toContain("57");
    expect(of("schoolYear", "delete")).toEqual([]);
  });

  it("counts the receipts of that year and no other", async () => {
    year();
    await deleteSchoolYearAction("year-1");
    expect(only("payment", "count").args).toMatchObject({
      where: { schoolYearId: "year-1" },
    });
  });

  it("still deletes a year entered in error", async () => {
    // One nobody has enrolled anybody on, and nothing has been paid against.
    // That is the case the button is for.
    year();
    const state = await deleteSchoolYearAction("year-1");

    expect(state.status).toBe("success");
    expect(only("schoolYear", "delete").args).toEqual({
      where: { id: "year-1" },
    });
  });

  it("authorizes against the school the year belongs to", async () => {
    // Resolved from the row, never from the request.
    year();
    await deleteSchoolYearAction("year-1");
    expect(asked).toEqual([PERMISSIONS.SCHOOL_YEAR_DELETE]);
  });

  it("refuses somebody without the delete code", async () => {
    year();
    granted.clear();
    granted.add(PERMISSIONS.SCHOOL_YEAR_UPDATE);

    const state = await deleteSchoolYearAction("year-1");
    expect(state.status).toBe("error");
    expect(of("schoolYear", "delete")).toEqual([]);
  });

  it("refuses a year nobody declared", async () => {
    const state = await deleteSchoolYearAction("nowhere");
    expect(state.status).toBe("error");
    expect(of("enrollment", "count")).toEqual([]);
    expect(of("payment", "count")).toEqual([]);
    expect(of("schoolYear", "delete")).toEqual([]);
  });

  it("checks who may before it counts anything", async () => {
    year();
    granted.clear();
    await deleteSchoolYearAction("year-1");
    expect(of("enrollment", "count")).toEqual([]);
    expect(of("payment", "count")).toEqual([]);
  });
});

// ── At most one default year ─────────────────────────────────────────────────

describe("the default year", () => {
  it("demotes whichever held it", async () => {
    // MySQL cannot express a partial unique index through Prisma, so every
    // write that sets `isDefault` has to clear the others first.
    await makeDefaultYear("school-1", "year-2");

    expect(only("schoolYear", "updateMany").args).toMatchObject({
      where: { schoolId: "school-1", isDefault: true, NOT: { id: "year-2" } },
      data: { isDefault: false },
    });
    expect(only("schoolYear", "update").args).toMatchObject({
      where: { id: "year-2" },
      data: { isDefault: true },
    });
  });

  it("keeps the promotion out of its own sweep", async () => {
    await makeDefaultYear("school-1", "year-2");
    const where = (only("schoolYear", "updateMany").args as {
      where: { NOT?: { id: string } };
    }).where;
    expect(where.NOT!.id).toBe("year-2");
  });

  it("sweeps unqualified when nothing is being kept", async () => {
    // What a *creation* does: there is no id yet to preserve.
    await clearOtherDefaultYears("school-1");
    const where = (only("schoolYear", "updateMany").args as {
      where: Record<string, unknown>;
    }).where;
    expect(where).not.toHaveProperty("NOT");
  });

  it("never reaches past the school", async () => {
    // A default year is one school's answer; demoting another school's would be
    // the tenant boundary going out through a helper.
    await clearOtherDefaultYears("school-1", "year-2");
    expect(only("schoolYear", "updateMany").args).toMatchObject({
      where: { schoolId: "school-1" },
    });
  });

  it("authorizes through the year's own school", async () => {
    answers = { "schoolYear.findUnique": { schoolId: "school-1" } };
    await setDefaultSchoolYearAction("year-2");
    expect(asked).toEqual([PERMISSIONS.SCHOOL_YEAR_UPDATE]);
  });

  it("refuses a year nobody declared", async () => {
    const state = await setDefaultSchoolYearAction("nowhere");
    expect(state.status).toBe("error");
    expect(of("schoolYear", "updateMany")).toEqual([]);
  });
});

// ── Starting a year from the last one ────────────────────────────────────────

describe("shiftInDays", () => {
  it("moves by whole weeks, so a Monday stays a Monday", () => {
    // The bell schedule is keyed on the day of the week, and `planSchoolWeeks`
    // decides whether a week is taught by looking at Monday to Saturday — a
    // holiday that slid mid-week would quietly change which weeks count.
    const shift = shiftInDays(new Date(2025, 8, 1), new Date(2026, 8, 7));
    expect(shift % 7).toBe(0);
  });

  it("rounds to the nearest week rather than truncating", () => {
    // Three days apart is no shift; four is a week. The drift is visible and
    // correctable; a weekday shift is not.
    expect(shiftInDays(new Date(2025, 8, 1), new Date(2025, 8, 4))).toBe(0);
    expect(shiftInDays(new Date(2025, 8, 1), new Date(2025, 8, 5))).toBe(7);
  });

  it("moves backwards for a year that starts earlier", () => {
    expect(shiftInDays(new Date(2025, 8, 8), new Date(2025, 8, 1))).toBe(-7);
  });

  it("does not move a year onto its own dates", () => {
    const day = new Date(2025, 8, 1);
    expect(shiftInDays(day, day)).toBe(0);
  });

  it("keeps a year apart by a whole number of weeks across a leap year", () => {
    // 2024 is a leap year; 366 days is not a multiple of seven.
    const shift = shiftInDays(new Date(2024, 8, 2), new Date(2025, 8, 1));
    expect(shift % 7).toBe(0);
  });
});

describe("copyYearConfiguration", () => {
  const bothYears = (sourceSchool = "school-1", targetSchool = "school-1") => {
    let seen = 0;
    answers = {
      get "schoolYear.findUnique"() {
        seen += 1;
        return seen === 1
          ? { id: "year-1", startDate: new Date(2025, 8, 1), schoolId: sourceSchool }
          : { id: "year-2", startDate: new Date(2026, 8, 7), schoolId: targetSchool };
      },
    } as unknown as Record<string, unknown>;
  };

  it("copies nothing across two schools", async () => {
    // The action checks this too, but the rule belongs to the data: a price
    // list copied across schools would be one tenant's figures landing in
    // another's.
    bothYears("school-1", "school-2");
    const result = await copyYearConfiguration("year-1", "year-2", [
      ...YEAR_COPY_PARTS,
    ]);

    expect(result.feeRates).toBe(0);
    expect(result.classes).toBe(0);
    expect(copiedInOrder).toEqual([]);
  });

  it("copies nothing when either year is missing", async () => {
    const result = await copyYearConfiguration("year-1", "nowhere", [
      "CALENDAR",
    ]);
    expect(result.weeks).toBe(0);
    expect(copiedInOrder).toEqual([]);
  });

  it("lays the weeks out after the holidays", async () => {
    // Which weeks are taught depends on them, so the order is load-bearing
    // rather than incidental.
    bothYears();
    await copyYearConfiguration("year-1", "year-2", ["CALENDAR"]);

    expect(copiedInOrder.indexOf("holidays")).toBeLessThan(
      copiedInOrder.indexOf("weeks"),
    );
  });

  it("copies only the parts it was asked for", async () => {
    bothYears();
    const result = await copyYearConfiguration("year-1", "year-2", ["FEES"]);

    expect(result.feeRates).toBe(3);
    expect(result.classes).toBe(0);
    expect(result.stops).toBe(0);
    expect(copiedInOrder).toEqual([]);
  });

  it("copies each group independently", async () => {
    for (const part of YEAR_COPY_PARTS) {
      copiedInOrder.length = 0;
      bothYears();
      const result = await copyYearConfiguration("year-1", "year-2", [part]);
      const total =
        result.terms + result.timeSlots + result.holidays + result.weeks +
        result.offerings + result.classes + result.groups +
        result.feeRates + result.discounts +
        result.transportSchedules + result.routes + result.stops;
      expect(total, part).toBeGreaterThan(0);
    }
  });

  it("copies nothing at all when asked for nothing", async () => {
    bothYears();
    const result = await copyYearConfiguration("year-1", "year-2", []);
    expect(Object.values(result).every((count) => count === 0)).toBe(true);
  });

  it("creates every copied term as planned, whatever the source said", async () => {
    // A semester copied from a year that has finished is not itself finished,
    // and carrying CLOSED across would lock a term nobody has taught yet.
    bothYears();
    answers["term.findMany"] = [
      {
        number: 1,
        name: "Semestre 1",
        nameAr: null,
        startDate: new Date(2025, 8, 1),
        endDate: new Date(2026, 0, 31),
        status: "CLOSED",
      },
    ];
    await copyYearConfiguration("year-1", "year-2", ["CALENDAR"]);

    const create = (only("term", "upsert").args as {
      create: Record<string, unknown>;
    }).create;
    expect(create["status"]).toBe("PLANNED");
  });

  it("never overwrites a term somebody has already dated", async () => {
    // Idempotent on (year, number): a year whose semesters have been edited
    // keeps them.
    bothYears();
    answers["term.findMany"] = [
      {
        number: 1,
        name: "Semestre 1",
        nameAr: null,
        startDate: new Date(2025, 8, 1),
        endDate: new Date(2026, 0, 31),
        status: "ACTIVE",
      },
    ];
    await copyYearConfiguration("year-1", "year-2", ["CALENDAR"]);

    expect((only("term", "upsert").args as { update: unknown }).update).toEqual(
      {},
    );
  });

  it("shifts the copied term by whole weeks", async () => {
    bothYears();
    answers["term.findMany"] = [
      {
        number: 1,
        name: "Semestre 1",
        nameAr: null,
        startDate: new Date(2025, 8, 1),
        endDate: new Date(2026, 0, 31),
        status: "PLANNED",
      },
    ];
    await copyYearConfiguration("year-1", "year-2", ["CALENDAR"]);

    const create = (only("term", "upsert").args as {
      create: { startDate: Date };
    }).create;
    // 1 September 2025 is a Monday; the shifted date must be one too.
    expect(create.startDate.getDay()).toBe(new Date(2025, 8, 1).getDay());
  });
});

// ── The declared sets ────────────────────────────────────────────────────────

describe("the statuses and the copy groups", () => {
  it("gives a year and a term the same three words", () => {
    // So the two read consistently — while staying distinct types, because
    // closing a term locks mark entry and closing a year archives it.
    expect([...SCHOOL_YEAR_STATUSES]).toEqual(["PLANNED", "ACTIVE", "CLOSED"]);
    expect([...TERM_STATUSES]).toEqual([...SCHOOL_YEAR_STATUSES]);
  });

  it("allows a third trimester without hard-coding two semesters", () => {
    // Moroccan schools run two, but some primary schools still work in three.
    expect(TERMS_PER_YEAR_DEFAULT).toBe(2);
    expect(TERM_NUMBER_MAX).toBeGreaterThanOrEqual(TERMS_PER_YEAR_DEFAULT);
    expect(TERM_NUMBER_MAX).toBe(3);
  });

  it("offers four groups rather than a tick-box per table", () => {
    // A school thinks in "the calendar" and "the classes"; fourteen tick-boxes
    // would be asking the operator to know which table a class group lives in.
    expect([...YEAR_COPY_PARTS]).toEqual([
      "CALENDAR",
      "STRUCTURE",
      "FEES",
      "TRANSPORT",
    ]);
  });

  it("names no group that carries a person", () => {
    // No pupil, no abonnement, no professeur principal. What a year holds about
    // people is that year's own business, and copying it is how a September
    // starts out quietly wrong.
    for (const part of YEAR_COPY_PARTS) {
      expect(["PUPILS", "STAFF", "ENROLMENTS", "PEOPLE"], part).not.toContain(
        part,
      );
    }
  });
});
