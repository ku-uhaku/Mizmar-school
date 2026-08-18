import { describe, expect, it, vi } from "vitest";

/**
 * The guard that stands between a configuration delete and the database.
 *
 * It reads Prisma's own relation graph rather than a hand-kept list, so what is
 * worth pinning is the reading: which relations count as *dependents*, that a
 * table pointing at the row from two columns is still one table and not two,
 * and that every blocking table comes back — the refusal names all of them, and
 * a secretary who clears the one table they were told about only to be refused
 * again has been told nothing.
 */

type CountArgs = { where: { OR: Record<string, string>[] } };

/** Every `count` the walk issued, keyed by the table it was issued against. */
const counted = new Map<string, CountArgs>();

/**
 * A cut-down `_runtimeDataModel` in the shape Prisma exposes: `Room` is pointed
 * at by classes and by lessons, `Student` points at it from two columns, and
 * `school` is the row's own outward foreign key — the one relation that must
 * never be probed.
 */
const runtimeDataModel = {
  models: {
    Room: {
      fields: [
        { name: "id", kind: "scalar", type: "String" },
        { name: "schoolId", kind: "scalar", type: "String" },
        { name: "school", kind: "object", type: "School", relationName: "SchoolToRoom" },
        { name: "classes", kind: "object", type: "SchoolClass", relationName: "RoomToSchoolClass" },
        { name: "lessons", kind: "object", type: "TimetableEntry", relationName: "RoomToTimetableEntry" },
        { name: "bornHere", kind: "object", type: "Student", relationName: "BirthRoomToStudent" },
        { name: "sitsHere", kind: "object", type: "Student", relationName: "SeatRoomToStudent" },
      ],
    },
    School: {
      fields: [{ name: "rooms", kind: "object", type: "Room", relationName: "SchoolToRoom" }],
    },
    SchoolClass: {
      fields: [{ name: "room", kind: "object", type: "Room", relationName: "RoomToSchoolClass" }],
    },
    TimetableEntry: {
      fields: [{ name: "room", kind: "object", type: "Room", relationName: "RoomToTimetableEntry" }],
    },
    Student: {
      fields: [
        { name: "birthRoom", kind: "object", type: "Room", relationName: "BirthRoomToStudent" },
        { name: "seatRoom", kind: "object", type: "Room", relationName: "SeatRoomToStudent" },
      ],
    },
  },
};

/** How many rows each table answers with, whatever it is asked. */
const rowCounts: Record<string, number> = {
  schoolClass: 2,
  timetableEntry: 9,
  student: 0,
  school: 7,
};

vi.mock("@/lib/db", () => {
  const delegates = new Proxy(
    {},
    {
      get: (_target, key: string) => {
        if (key === "_runtimeDataModel") return runtimeDataModel;
        return {
          count: (args: CountArgs) => {
            counted.set(key, args);
            return Promise.resolve(rowCounts[key] ?? 0);
          },
        };
      },
    },
  );
  return { db: delegates, auditClient: {} };
});

const { findBlockingReferences } = await import(
  "@/modules/configuration/resource-schema"
);

describe("findBlockingReferences", () => {
  it("names every table still pointing at the row, heaviest first", async () => {
    counted.clear();
    const blocking = await findBlockingReferences("Room", "room-1");

    expect(blocking).toEqual([
      { model: "TimetableEntry", count: 9 },
      { model: "SchoolClass", count: 2 },
    ]);
  });

  it("never probes the row's own outward relation", async () => {
    counted.clear();
    await findBlockingReferences("Room", "room-1");

    // `school` sits beside this model's own `schoolId`: the room points at the
    // school, so no school row is orphaned by deleting it. Counting it would
    // refuse every delete, since every room has a school.
    expect(counted.has("school")).toBe(false);
  });

  it("counts a table pointing from two columns once", async () => {
    counted.clear();
    await findBlockingReferences("Room", "room-1");

    // Two relations, one table, one count with an `OR` — a pupil born here and
    // seated here is one pupil to go and fix, not two.
    expect(counted.get("student")?.where).toEqual({
      OR: [{ birthRoomId: "room-1" }, { seatRoomId: "room-1" }],
    });
  });

  it("says nothing about a table with no rows in the way", async () => {
    counted.clear();
    const blocking = await findBlockingReferences("Room", "room-1");

    expect(blocking.map((reference) => reference.model)).not.toContain("Student");
  });

  it("lets a delete through when the relation graph cannot be read", async () => {
    // The graph is undocumented — see the note on `runtimeDataModel`. A model
    // it does not know degrades to "nothing in the way" rather than throwing,
    // so a rename in a future Prisma unguards the delete instead of breaking it.
    expect(await findBlockingReferences("Unknown", "x")).toEqual([]);
  });
});
