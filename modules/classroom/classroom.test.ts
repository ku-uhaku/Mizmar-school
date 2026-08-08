import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDictionaryFor } from "@/lib/i18n/server";
import {
  ATTENDANCE_STATUSES,
  JUSTIFIABLE_STATUSES,
  MAX_MINUTES_LATE,
  MISSING_STATUSES,
  REMARK_KINDS,
  REMARK_MAX_LENGTH,
  REMARK_TONES,
  attendanceScopeKey,
  lessonAt,
  startOfDay,
  tallyAttendance,
  wasPresent,
} from "@/modules/classroom/enums";
import { remarkSchema } from "@/modules/classroom/validation";

/**
 * L'espace enseignant: the register, the carnet, and who may write in them.
 *
 * No permission can express "only their own classes", so the confinement lives
 * in the queries and in the service rather than in a code somebody grants — and
 * that is exactly why it needs testing. Four rules carry the module:
 *
 *   1. **A teacher writes against a roster they teach.** Re-derived from the
 *      `TeachingAssignment` rows on every write, never taken from the request.
 *   2. **`actsForSchool` relaxes which roster, never which school.** A director
 *      covering an absent colleague still has to take the register; a class in
 *      another school still reaches nothing.
 *   3. **A retard is not a half-absence.** Schools act on lates by
 *      accumulation, so the count has to survive everything that touches the
 *      row.
 *   4. **A remark reaches the family only by a second, conscious act.** A
 *      teacher records a concern for their colleagues; releasing it is somebody
 *      else's decision.
 */

// ─────────────────────────────────────────────────────────────────────────────

type Call = { model: string; op: string; args: unknown };

const calls: Call[] = [];
let answers: Record<string, unknown> = {};

const EMPTY: Record<string, unknown> = {
  findMany: [],
  count: 0,
  findFirst: null,
  findUnique: null,
  create: {},
  update: {},
  upsert: {},
};

const db = new Proxy(
  {},
  {
    get: (_target, model: string) => {
      if (model === "$transaction") {
        return async (operations: unknown[]) => Promise.all(operations);
      }
      return new Proxy(
        {},
        {
          get: (_d, op: string) => async (args: unknown) => {
            calls.push({ model, op, args });
            const key = `${model}.${op}`;
            if (key in answers) return answers[key];
            return op in EMPTY ? EMPTY[op] : null;
          },
        },
      );
    },
  },
);

vi.mock("@/lib/db", () => ({ db, auditClient: {} }));

const { justifyAbsence, saveRegister, writeRemark } = await import(
  "@/modules/classroom/service"
);

const of = (model: string, op: string) =>
  calls.filter((call) => call.model === model && call.op === op);

const only = (model: string, op: string): Call => {
  const matches = of(model, op);
  expect(matches, `${model}.${op}`).toHaveLength(1);
  return matches[0]!;
};

beforeEach(() => {
  calls.length = 0;
  answers = {};
});

// ── The four statuses ────────────────────────────────────────────────────────

describe("attendance statuses", () => {
  it("counts a late pupil as having turned up", () => {
    // LATE is a status of its own rather than a flag on PRESENT, but the child
    // was in the room — an attendance rate that counted them absent would be
    // wrong about the thing it is named after.
    expect(ATTENDANCE_STATUSES.filter(wasPresent)).toEqual(["PRESENT", "LATE"]);
  });

  it("treats absent and excused as not in the room", () => {
    expect([...MISSING_STATUSES]).toEqual(["ABSENT", "EXCUSED"]);
    for (const status of MISSING_STATUSES) {
      expect(wasPresent(status), status).toBe(false);
    }
  });

  it("splits every status into exactly one of the two", () => {
    for (const status of ATTENDANCE_STATUSES) {
      expect(wasPresent(status), status).toBe(!MISSING_STATUSES.includes(status));
    }
  });

  it("says nothing about a status it has never heard of", () => {
    for (const nonsense of ["", "present", "ABSENT ", "__proto__"]) {
      expect(wasPresent(nonsense), nonsense).toBe(false);
    }
  });

  it("accepts a justification for an absence or a retard, never for a present pupil", () => {
    // The note explaining why a child arrived at half past eight is the same
    // piece of paper as the one explaining why they did not come at all.
    expect([...JUSTIFIABLE_STATUSES].sort()).toEqual([
      "ABSENT",
      "EXCUSED",
      "LATE",
    ]);
    expect(JUSTIFIABLE_STATUSES).not.toContain("PRESENT");
  });
});

describe("tallyAttendance", () => {
  const mark = (status: string | null) => ({ status });

  it("counts each status separately", () => {
    const tally = tallyAttendance([
      mark("PRESENT"),
      mark("PRESENT"),
      mark("LATE"),
      mark("ABSENT"),
      mark("EXCUSED"),
    ]);
    expect(tally).toEqual({
      present: 2,
      late: 1,
      absent: 1,
      excused: 1,
      unmarked: 0,
      total: 5,
    });
  });

  it("keeps lateness out of the present count", () => {
    // The whole reason LATE is its own status: three retards and somebody
    // writes to the family, and that count is impossible if it hides inside
    // "present".
    const tally = tallyAttendance([mark("LATE"), mark("LATE")]);
    expect(tally.present).toBe(0);
    expect(tally.late).toBe(2);
  });

  it("counts a pupil nobody marked as unmarked, not as present", () => {
    // A register that was never taken is not a class that turned up.
    const tally = tallyAttendance([mark(null), mark("PRESENT")]);
    expect(tally.unmarked).toBe(1);
    expect(tally.present).toBe(1);
  });

  it("adds up to the roster, whatever the mix", () => {
    const marks = [
      ...ATTENDANCE_STATUSES.map((status) => mark(status)),
      mark(null),
      mark("SOMETHING_ELSE"),
    ];
    const tally = tallyAttendance(marks);
    // The stray value is in `total` and in none of the buckets — which is how a
    // corrupted row shows up as a discrepancy rather than as a wrong count.
    expect(tally.total).toBe(marks.length);
    expect(
      tally.present + tally.late + tally.absent + tally.excused + tally.unmarked,
    ).toBe(marks.length - 1);
  });

  it("tallies an empty register as empty", () => {
    expect(tallyAttendance([])).toEqual({
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      unmarked: 0,
      total: 0,
    });
  });
});

// ── The day, and the lesson ──────────────────────────────────────────────────

describe("startOfDay", () => {
  it("takes the local midnight, so two marks for one day compare equal", () => {
    const morning = startOfDay(new Date(2026, 0, 15, 8, 30));
    const evening = startOfDay(new Date(2026, 0, 15, 19, 45));
    expect(morning.getTime()).toBe(evening.getTime());
    expect(morning.getHours()).toBe(0);
    expect(morning.getDate()).toBe(15);
  });

  it("does not move the date", () => {
    // Local rather than UTC: Morocco is ahead of UTC, so reading the UTC day
    // would file an evening register under tomorrow for part of the year.
    const day = startOfDay(new Date(2026, 0, 15, 23, 59));
    expect(day.getFullYear()).toBe(2026);
    expect(day.getMonth()).toBe(0);
    expect(day.getDate()).toBe(15);
  });

  it("does not mutate what it was given", () => {
    const original = new Date(2026, 0, 15, 8, 30);
    startOfDay(original);
    expect(original.getHours()).toBe(8);
  });
});

describe("lessonAt", () => {
  const lesson = (startTime: string, endTime: string) => ({ startTime, endTime });
  const day = [
    lesson("08:00", "09:00"),
    lesson("09:00", "10:00"),
    lesson("14:00", "15:00"),
  ];
  const at = (hours: number, minutes = 0) => new Date(2026, 0, 15, hours, minutes);

  it("opens on the lesson being taught", () => {
    // A teacher opening the appel is standing in front of a class.
    expect(lessonAt(day, at(9, 30))).toEqual(day[1]);
  });

  it("opens on the start of a lesson, not the end of the last one", () => {
    expect(lessonAt(day, at(9))).toEqual(day[1]);
    expect(lessonAt(day, at(8, 59))).toEqual(day[0]);
  });

  it("looks forward between two periods", () => {
    // A register is taken at the start of a lesson, not after the previous one
    // has ended.
    expect(lessonAt(day, at(12))).toEqual(day[2]);
  });

  it("opens on the first lesson before the first bell", () => {
    expect(lessonAt(day, at(7))).toEqual(day[0]);
  });

  it("stops at the last lesson once the day is over", () => {
    // Which is what somebody marking up in the evening means.
    expect(lessonAt(day, at(18))).toEqual(day[2]);
  });

  it("does not depend on the order it was handed the day", () => {
    // Sorted internally, so the rule cannot quietly become a rule about list
    // position.
    const shuffled = [day[2]!, day[0]!, day[1]!];
    expect(lessonAt(shuffled, at(9, 30))).toEqual(day[1]);
    expect(lessonAt(shuffled, at(18))).toEqual(day[2]);
  });

  it("answers nothing for a day with no lessons", () => {
    expect(lessonAt([], at(9))).toBeNull();
  });
});

describe("attendanceScopeKey", () => {
  it("gives a whole-day register a real value rather than NULL", () => {
    // SQLite treats NULLs as distinct in a unique index, so a pupil could be
    // marked twice for the same day and every absence count would double.
    expect(attendanceScopeKey(null)).toBe("__day__");
  });

  it("keys a lesson's register on its period", () => {
    expect(attendanceScopeKey("slot-3")).toBe("slot-3");
  });

  it("never collides a period with the whole day", () => {
    expect(attendanceScopeKey("slot-3")).not.toBe(attendanceScopeKey(null));
  });
});

// ── Taking the register ──────────────────────────────────────────────────────

const ROSTER = [{ id: "enrol-1" }, { id: "enrol-2" }, { id: "enrol-3" }];

const attendanceMark = (extra: Record<string, unknown> = {}) => ({
  enrollmentId: "enrol-1",
  status: "PRESENT",
  minutesLate: null as number | null,
  reason: null as string | null,
  ...extra,
});

const register = (extra: Record<string, unknown> = {}) => ({
  teacherId: "teacher-1",
  schoolId: "school-1",
  actsForSchool: false,
  schoolClassId: "class-1",
  subjectId: "maths",
  timeSlotId: "slot-1",
  date: new Date(2026, 0, 15, 8, 30),
  marks: [attendanceMark()],
  ...extra,
}) as Parameters<typeof saveRegister>[0];

/** What the upserts were asked to create. */
const written = () =>
  of("studentAttendance", "upsert").map(
    (call) => (call.args as { create: Record<string, unknown> }).create,
  );

describe("saveRegister", () => {
  const teaching = () => {
    answers = {
      "teachingAssignment.findFirst": { classGroupId: null },
      "enrollment.findMany": ROSTER,
    };
  };

  it("records a lesson's register", async () => {
    teaching();
    const result = await saveRegister(register());

    expect(result).toEqual({ ok: true, saved: 1 });
    expect(written()[0]).toMatchObject({
      enrollmentId: "enrol-1",
      status: "PRESENT",
      subjectId: "maths",
      timeSlotId: "slot-1",
      recordedById: "teacher-1",
    });
  });

  // ── Only your own classes ──────────────────────────────────────────────────

  it("refuses a class the teacher does not teach", async () => {
    // No assignment, no register. The rule the whole service exists to keep.
    answers = { "enrollment.findMany": ROSTER };
    const result = await saveRegister(register());

    expect(result).toEqual({ ok: false, reason: "not-teaching" });
    expect(of("studentAttendance", "upsert")).toEqual([]);
  });

  it("asks for the assignment by teacher, class and school together", async () => {
    teaching();
    await saveRegister(register());

    expect(only("teachingAssignment", "findFirst").args).toMatchObject({
      where: {
        teacherId: "teacher-1",
        schoolClassId: "class-1",
        schoolClass: { schoolId: "school-1" },
        subjectId: "maths",
      },
    });
  });

  it("does not narrow the assignment by subject for a whole-day register", async () => {
    // A primary teacher who has the class all morning marks the day, not a
    // subject — and has an assignment for each of the subjects they teach.
    teaching();
    await saveRegister(register({ subjectId: null, timeSlotId: null }));

    const where = (only("teachingAssignment", "findFirst").args as {
      where: Record<string, unknown>;
    }).where;
    expect(where).not.toHaveProperty("subjectId");
  });

  it("narrows the roster to the half the teacher has", async () => {
    // A language or lab subject taught in halves: the other half is not in the
    // room and must not appear on the register.
    answers = {
      "teachingAssignment.findFirst": { classGroupId: "group-a" },
      "enrollment.findMany": ROSTER,
    };
    await saveRegister(register());

    expect(only("enrollment", "findMany").args).toMatchObject({
      where: { schoolClassId: "class-1", classGroupId: "group-a" },
    });
  });

  // ── The office standing in ─────────────────────────────────────────────────

  it("lets the office take the register for a class it does not teach", async () => {
    // A director covering an absent colleague still has to take the register,
    // and telling them to assign themselves first ends with a fake assignment
    // left behind.
    answers = {
      "schoolClass.findFirst": { id: "class-1" },
      "enrollment.findMany": ROSTER,
    };
    const result = await saveRegister(register({ actsForSchool: true }));

    expect(result).toEqual({ ok: true, saved: 1 });
    expect(of("teachingAssignment", "findFirst")).toEqual([]);
  });

  it("still confines the office to its own school", async () => {
    // `actsForSchool` relaxes *which roster*, never *which school* — and the
    // school is the working context, never the request.
    answers = { "enrollment.findMany": ROSTER };
    const result = await saveRegister(register({ actsForSchool: true }));

    expect(result).toEqual({ ok: false, reason: "not-teaching" });
    expect(of("studentAttendance", "upsert")).toEqual([]);
  });

  it("looks the class up under the school in context", async () => {
    answers = {
      "schoolClass.findFirst": { id: "class-1" },
      "enrollment.findMany": ROSTER,
    };
    await saveRegister(register({ actsForSchool: true }));

    expect(only("schoolClass", "findFirst").args).toMatchObject({
      where: { id: "class-1", schoolId: "school-1" },
    });
  });

  it("marks the whole class when the office stands in, not half of it", async () => {
    // Somebody standing in has no group of their own, and guessing one would
    // silently leave half the register unmarked.
    answers = {
      "schoolClass.findFirst": { id: "class-1" },
      "enrollment.findMany": ROSTER,
    };
    await saveRegister(register({ actsForSchool: true }));

    const where = (only("enrollment", "findMany").args as {
      where: Record<string, unknown>;
    }).where;
    expect(where).not.toHaveProperty("classGroupId");
  });

  // ── The roster decides ─────────────────────────────────────────────────────

  it("writes nothing for a pupil who is not in this lesson", async () => {
    teaching();
    const result = await saveRegister(
      register({ marks: [attendanceMark({ enrollmentId: "someone-else" })] }),
    );

    expect(result).toEqual({ ok: true, saved: 0 });
    expect(of("studentAttendance", "upsert")).toEqual([]);
  });

  it("writes the seated pupils and drops the rest", async () => {
    teaching();
    const result = await saveRegister(
      register({
        marks: [
          attendanceMark(),
          attendanceMark({ enrollmentId: "smuggled", status: "ABSENT" }),
        ],
      }),
    );

    expect(result).toEqual({ ok: true, saved: 1 });
    expect(written().map((row) => row["enrollmentId"])).toEqual(["enrol-1"]);
  });

  // ── The retard ─────────────────────────────────────────────────────────────

  it("keeps the minutes on a retard", async () => {
    teaching();
    await saveRegister(
      register({
        marks: [attendanceMark({ status: "LATE", minutesLate: 12 })],
      }),
    );
    expect(written()[0]).toMatchObject({ status: "LATE", minutesLate: 12 });
  });

  it("clears the minutes for every status but LATE", async () => {
    // A stale figure on a pupil who turned out to be present would put a retard
    // in their yearly count that nobody recorded.
    for (const status of ["PRESENT", "ABSENT", "EXCUSED"]) {
      calls.length = 0;
      teaching();
      await saveRegister(
        register({ marks: [attendanceMark({ status, minutesLate: 12 })] }),
      );
      expect(written()[0]!["minutesLate"], status).toBeNull();
    }
  });

  it("refuses a retard longer than a lesson", async () => {
    teaching();
    expect(
      await saveRegister(
        register({
          marks: [
            attendanceMark({ status: "LATE", minutesLate: MAX_MINUTES_LATE + 1 }),
          ],
        }),
      ),
    ).toEqual({ ok: false, reason: "out-of-range" });
  });

  it("refuses negative minutes", async () => {
    teaching();
    expect(
      await saveRegister(
        register({ marks: [attendanceMark({ status: "LATE", minutesLate: -5 })] }),
      ),
    ).toEqual({ ok: false, reason: "out-of-range" });
  });

  it("accepts a retard of exactly the maximum, and of none at all", async () => {
    for (const minutesLate of [0, MAX_MINUTES_LATE]) {
      calls.length = 0;
      teaching();
      expect(
        await saveRegister(
          register({ marks: [attendanceMark({ status: "LATE", minutesLate })] }),
        ),
        String(minutesLate),
      ).toEqual({ ok: true, saved: 1 });
    }
  });

  it("refuses the whole register when one row is out of range", async () => {
    // Rather than writing the rest: a half-taken register is how one pupil ends
    // up with yesterday's status.
    teaching();
    const result = await saveRegister(
      register({
        marks: [
          attendanceMark(),
          attendanceMark({
            enrollmentId: "enrol-2",
            status: "LATE",
            minutesLate: 9999,
          }),
        ],
      }),
    );
    expect(result).toEqual({ ok: false, reason: "out-of-range" });
    expect(of("studentAttendance", "upsert")).toEqual([]);
  });

  it("refuses a fractional minute rather than rounding it", async () => {
    teaching();
    expect(
      await saveRegister(
        register({
          marks: [attendanceMark({ status: "LATE", minutesLate: 7.5 })],
        }),
      ),
    ).toEqual({ ok: false, reason: "out-of-range" });
  });

  // ── The justification survives ─────────────────────────────────────────────

  it("does not touch a justification the office has accepted", async () => {
    // A teacher retaking the register must not undo it — which is why
    // `isJustified` is absent from the update entirely rather than written
    // false.
    teaching();
    await saveRegister(register());

    const call = only("studentAttendance", "upsert").args as {
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    };
    expect(call.update).not.toHaveProperty("isJustified");
    expect(call.create).not.toHaveProperty("isJustified");
  });

  it("keys the row on the pupil, the day and the period", async () => {
    teaching();
    await saveRegister(register());

    const call = only("studentAttendance", "upsert").args as { where: unknown };
    expect(call.where).toEqual({
      enrollmentId_date_scopeKey: {
        enrollmentId: "enrol-1",
        date: startOfDay(new Date(2026, 0, 15, 8, 30)),
        scopeKey: "slot-1",
      },
    });
  });

  it("keys a whole-day register on the day sentinel", async () => {
    teaching();
    await saveRegister(register({ timeSlotId: null, subjectId: null }));

    const call = only("studentAttendance", "upsert").args as {
      where: { enrollmentId_date_scopeKey: { scopeKey: string } };
    };
    expect(call.where.enrollmentId_date_scopeKey.scopeKey).toBe("__day__");
  });

  it("stores midnight, whatever time of day it was taken", async () => {
    teaching();
    await saveRegister(register({ date: new Date(2026, 0, 15, 16, 45) }));

    const stored = written()[0]!["date"] as Date;
    expect(stored.getHours()).toBe(0);
    expect(stored.getDate()).toBe(15);
  });

  it("takes an empty register without complaint", async () => {
    teaching();
    expect(await saveRegister(register({ marks: [] }))).toEqual({
      ok: true,
      saved: 0,
    });
  });
});

// ── Accepting a justification ────────────────────────────────────────────────

describe("justifyAbsence", () => {
  const dataOf = () =>
    (only("studentAttendance", "update").args as {
      data: Record<string, unknown>;
    }).data;

  it("promotes a plain absence to an excused one", async () => {
    await justifyAbsence("mark-1", "ABSENT", true, "Certificat médical.");
    expect(dataOf()).toMatchObject({
      isJustified: true,
      status: "EXCUSED",
      reason: "Certificat médical.",
    });
  });

  it("puts an excused absence back when the justification is withdrawn", async () => {
    await justifyAbsence("mark-1", "EXCUSED", false, null);
    expect(dataOf()).toMatchObject({ isJustified: false, status: "ABSENT" });
  });

  it("leaves a retard a retard", async () => {
    // The bug this closes. Justifying a late used to rewrite it as EXCUSED,
    // which is an absence — and a school writes to the family on the third
    // retard, so erasing one erases the letter. The pupil's file has always
    // counted unjustified lates separately; the write did not know about them.
    await justifyAbsence("mark-1", "LATE", true, "Bus en retard.");

    const data = dataOf();
    expect(data["isJustified"]).toBe(true);
    expect(data).not.toHaveProperty("status");
    expect(data["reason"]).toBe("Bus en retard.");
  });

  it("leaves a retard a retard when the justification is withdrawn too", async () => {
    await justifyAbsence("mark-1", "LATE", false, null);
    expect(dataOf()).not.toHaveProperty("status");
    expect(dataOf()["isJustified"]).toBe(false);
  });

  it("keeps the existing reason when none is given", async () => {
    // Toggling the flag from a list must not wipe the note somebody typed.
    await justifyAbsence("mark-1", "ABSENT", true, null);
    expect(dataOf()).not.toHaveProperty("reason");
  });

  it("writes an empty reason when one is given deliberately", async () => {
    await justifyAbsence("mark-1", "ABSENT", true, "");
    expect(dataOf()["reason"]).toBe("");
  });

  it("touches only the row it was given", async () => {
    await justifyAbsence("mark-1", "ABSENT", true, null);
    expect(only("studentAttendance", "update").args).toMatchObject({
      where: { id: "mark-1" },
    });
  });
});

// ── The carnet ───────────────────────────────────────────────────────────────

const remark = (extra: Record<string, unknown> = {}) =>
  ({
    authorId: "teacher-1",
    schoolId: "school-1",
    actsForSchool: false,
    enrollmentId: "enrol-1",
    subjectId: "maths",
    kind: "WORK",
    tone: "CONCERN",
    body: "N'apporte pas son livre.",
    occurredOn: new Date(2026, 0, 15),
    isVisibleToFamily: false,
    ...extra,
  }) as Parameters<typeof writeRemark>[0];

describe("writeRemark", () => {
  const teaches = () => {
    answers = { "enrollment.findFirst": { id: "enrol-1" } };
  };

  it("writes an observation about a pupil the teacher teaches", async () => {
    teaches();
    expect(await writeRemark(remark())).toEqual({ ok: true });
    expect(only("studentRemark", "create").args).toMatchObject({
      data: {
        enrollmentId: "enrol-1",
        kind: "WORK",
        tone: "CONCERN",
        authorId: "teacher-1",
      },
    });
  });

  it("checks the pupil against the teacher's own assignments", async () => {
    // This text may end up in front of a family, so the enrolment is checked
    // rather than trusted.
    teaches();
    await writeRemark(remark());

    expect(only("enrollment", "findFirst").args).toMatchObject({
      where: {
        id: "enrol-1",
        schoolClass: {
          schoolId: "school-1",
          assignments: { some: { teacherId: "teacher-1" } },
        },
      },
    });
  });

  it("refuses a pupil the teacher does not teach", async () => {
    expect(await writeRemark(remark())).toEqual({ ok: false });
    expect(of("studentRemark", "create")).toEqual([]);
  });

  it("lets the office write about any pupil of the school", async () => {
    teaches();
    await writeRemark(remark({ actsForSchool: true }));

    const where = (only("enrollment", "findFirst").args as {
      where: { schoolClass: Record<string, unknown> };
    }).where;
    expect(where.schoolClass).not.toHaveProperty("assignments");
    expect(where.schoolClass["schoolId"]).toBe("school-1");
  });

  it("still confines the office to its own school", async () => {
    answers = {};
    expect(await writeRemark(remark({ actsForSchool: true }))).toEqual({
      ok: false,
    });
    expect(of("studentRemark", "create")).toEqual([]);
  });

  it("writes against the enrolment it resolved, not the one it was handed", async () => {
    answers = { "enrollment.findFirst": { id: "resolved-enrolment" } };
    await writeRemark(remark());
    expect(only("studentRemark", "create").args).toMatchObject({
      data: { enrollmentId: "resolved-enrolment" },
    });
  });

  it("keeps a remark internal unless it was released", async () => {
    // False by default and deliberately so: a teacher must be able to record a
    // concern for their colleagues without it reaching the parents before the
    // school has decided what to say.
    teaches();
    await writeRemark(remark());
    const data = (only("studentRemark", "create").args as {
      data: Record<string, unknown>;
    }).data;
    expect(data["isVisibleToFamily"]).toBe(false);
  });

  it("releases one when the caller says so", async () => {
    teaches();
    await writeRemark(remark({ isVisibleToFamily: true }));
    const data = (only("studentRemark", "create").args as {
      data: Record<string, unknown>;
    }).data;
    expect(data["isVisibleToFamily"]).toBe(true);
  });
});

// ── Validation ───────────────────────────────────────────────────────────────

describe("remarkSchema", () => {
  const t = getDictionaryFor("en");
  const submission = (extra: Record<string, unknown> = {}) => ({
    enrollmentId: "enrol-1",
    subjectId: "maths",
    kind: "WORK",
    tone: "CONCERN",
    body: "N'apporte pas son livre.",
    occurredOn: "2026-01-15",
    ...extra,
  });

  it("accepts a well-formed remark", () => {
    expect(remarkSchema(t).safeParse(submission()).success).toBe(true);
  });

  it("accepts every kind and tone the module declares", () => {
    for (const kind of REMARK_KINDS) {
      expect(remarkSchema(t).safeParse(submission({ kind })).success, kind).toBe(
        true,
      );
    }
    for (const tone of REMARK_TONES) {
      expect(remarkSchema(t).safeParse(submission({ tone })).success, tone).toBe(
        true,
      );
    }
  });

  it("refuses a kind or a tone outside them", () => {
    for (const kind of ["", "RUDE", "work", "__proto__"]) {
      expect(remarkSchema(t).safeParse(submission({ kind })).success, kind).toBe(
        false,
      );
    }
    for (const tone of ["", "ANGRY", "positive"]) {
      expect(remarkSchema(t).safeParse(submission({ tone })).success, tone).toBe(
        false,
      );
    }
  });

  it("requires something to have been said", () => {
    // An empty remark in a carnet is a row nobody can act on.
    expect(remarkSchema(t).safeParse(submission({ body: "" })).success).toBe(false);
    expect(remarkSchema(t).safeParse(submission({ body: "   " })).success).toBe(
      false,
    );
  });

  it("keeps a remark to a paragraph rather than an essay", () => {
    expect(
      remarkSchema(t).safeParse(submission({ body: "x".repeat(REMARK_MAX_LENGTH) }))
        .success,
    ).toBe(true);
    expect(
      remarkSchema(t).safeParse(
        submission({ body: "x".repeat(REMARK_MAX_LENGTH + 1) }),
      ).success,
    ).toBe(false);
  });

  it("requires the pupil it is about", () => {
    expect(remarkSchema(t).safeParse(submission({ enrollmentId: "" })).success).toBe(
      false,
    );
  });

  it("strips anything the form did not declare", () => {
    const parsed = remarkSchema(t).safeParse({
      ...submission(),
      // The author is the session's, and release is a separate grant checked in
      // the action — neither is the form's to name.
      authorId: "somebody-else",
      isVisibleToFamily: true,
      schoolId: "another-school",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("authorId");
      expect(parsed.data).not.toHaveProperty("isVisibleToFamily");
      expect(parsed.data).not.toHaveProperty("schoolId");
    }
  });
});
