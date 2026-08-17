import { describe, expect, it } from "vitest";

import type { AuthContext } from "@/lib/dal";
import {
  currentSchoolId,
  currentSchoolYearId,
  schoolScope,
  staffOfSchool,
  teacherOfSchool,
  yearScope,
} from "@/lib/scope";

/**
 * The `where` fragments every module's reads are built on.
 *
 * Worth their own tests for one reason: each of them used to be copied per
 * module, and each divergence was a bug nobody could see in a diff. Two are
 * pinned here.
 *
 * **A missing context matches nothing rather than everything.** A request can
 * arrive with no school — a first login, a membership just revoked — and the
 * clause has to come back with an id that cannot match. An `undefined` would
 * drop the clause and hand the reader the whole organisation.
 *
 * **Belonging to a school is not the same as holding permissions in it.** That
 * conflation is what hid every teacher hired without a role from every teacher
 * picker in the app.
 */

const context = (
  schoolId: string | null,
  schoolYearId: string | null = null,
): AuthContext =>
  ({
    currentSchool: schoolId ? { id: schoolId } : null,
    currentSchoolYear: schoolYearId ? { id: schoolYearId } : null,
  }) as unknown as AuthContext;

describe("schoolScope and yearScope", () => {
  it("names the school and the year in context", () => {
    const held = context("school-1", "year-1");
    expect(schoolScope(held)).toEqual({ schoolId: "school-1" });
    expect(yearScope(held)).toEqual({ schoolYearId: "year-1" });
  });

  it("matches nothing when there is nothing in context", () => {
    // Not `undefined`: that would drop the clause and widen the read to the
    // whole organisation, which is the opposite of the honest answer.
    const empty = context(null, null);
    expect(schoolScope(empty).schoolId).toBe("__none__");
    expect(yearScope(empty).schoolYearId).toBe("__none__");
    expect(currentSchoolId(empty)).toBe("__none__");
    expect(currentSchoolYearId(empty)).toBe("__none__");
  });

  it("spells the sentinel the same way everywhere", () => {
    // Treasury used to spell it `NO_MATCH`. Two spellings of "match nothing" is
    // how two modules come to disagree about what no school means.
    const empty = context(null, null);
    expect(new Set([
      schoolScope(empty).schoolId,
      yearScope(empty).schoolYearId,
      currentSchoolId(empty),
      currentSchoolYearId(empty),
      staffOfSchool(currentSchoolId(empty)).OR[0].memberships.some.schoolId,
      staffOfSchool(currentSchoolId(empty)).OR[1].staffRecord.schoolId,
    ]).size).toBe(1);
  });
});

describe("staffOfSchool", () => {
  it("accepts a membership or an employment record, not only a membership", () => {
    /*
      The bug this exists to close. Hiring a teacher and opening their login
      without picking a role writes no membership — deliberately, see
      `createLoginAccount` — so a membership-only test reported "this school has
      no teachers" about people with a Staff row in the school, an active
      account and a matricule, and they could not be put on a class at all.
    */
    const where = staffOfSchool("school-1");

    expect(where.OR).toEqual([
      { memberships: { some: { schoolId: "school-1" } } },
      { staffRecord: { schoolId: "school-1" } },
    ]);
  });

  it("never offers a deactivated account", () => {
    // Excluded here rather than by each caller: leaving it to eleven call sites
    // is how one of them forgets.
    expect(staffOfSchool("school-1").isActive).toBe(true);
  });

  it("leaves the organisation to the caller", () => {
    // The tenant clause is spread alongside this one; baking it in would make
    // the fragment need an organisation it does not otherwise care about, and
    // hide from the call site that the read is tenant-scoped.
    expect(Object.keys(staffOfSchool("school-1")).sort()).toEqual([
      "OR",
      "isActive",
    ]);
  });
});

describe("teacherOfSchool", () => {
  /*
    Narrower than `staffOfSchool`, and the two must not be confused: one answers
    "does this person work here", which is the right test for a till's holder,
    and the other "may this person be given a lesson".

    The bug this closes is the school's manager — a SUPERVISOR, whom the payroll
    files under the teaching department — appearing in every teacher picker: on a
    class, on a timetable slot, on the availability grid, and on any `@teachers`
    reference in the configuration.
  */
  it("asks the employment record's jobRole, not the membership", () => {
    const where = teacherOfSchool("school-1");

    expect(where.staffRecord.schoolId).toBe("school-1");
    expect(where.staffRecord.jobRole.in).toEqual(["TEACHER"]);
    // No membership branch at all: `jobRole` lives on the employment record, so
    // an account with a membership and no Staff row cannot be said to teach
    // anything — that describes an administrator's login.
    expect(where).not.toHaveProperty("OR");
  });

  it("excludes only the employment status that means they have left", () => {
    const statuses = teacherOfSchool("school-1").staffRecord.status.in;

    expect(statuses).not.toContain("TERMINATED");
    // Still on the books, still on the timetable: whether a teacher on leave
    // takes their classes is the school's business rather than a filter's.
    expect(statuses).toContain("ON_LEAVE");
    expect(statuses).toContain("SUSPENDED");
  });

  it("never offers a deactivated account, like its wider sibling", () => {
    expect(teacherOfSchool("school-1").isActive).toBe(true);
  });

  it("leaves the organisation to the caller, like its wider sibling", () => {
    expect(Object.keys(teacherOfSchool("school-1")).sort()).toEqual([
      "isActive",
      "staffRecord",
    ]);
  });
});
