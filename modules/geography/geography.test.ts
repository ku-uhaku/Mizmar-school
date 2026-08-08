import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROOM_KINDS, LAB_ROOM_KINDS } from "@/modules/facilities/enums";
import type { AuthContext } from "@/lib/dal";

/**
 * Les villes et les quartiers — the two reference lists everything else picks
 * an address from.
 *
 * One question, asked from four screens: which towns and quartiers may this
 * form offer? Scoped to the school in the header like every other list, so
 * switching school changes it.
 *
 * The rule worth testing is the `include` one, because it exists to stop a
 * silent data loss rather than to make a screen nicer. Merging two spellings of
 * a town means deactivating the loser. A picker that offered only active rows
 * would then draw no option for the value already on the row being edited — and
 * the next Save would write it away. So a caller hands its own ids in, and they
 * survive the filter.
 *
 * That mechanism is only as good as every call site remembering it, which is
 * the shape of the bug fixed alongside these tests.
 */

// ─────────────────────────────────────────────────────────────────────────────

const calls: { model: string; op: string; args: unknown }[] = [];
let cities: Record<string, unknown>[] = [];
let neighbourhoods: Record<string, unknown>[] = [];

const db = new Proxy(
  {},
  {
    get: (_target, model: string) =>
      new Proxy(
        {},
        {
          get: (_d, op: string) => async (args: unknown) => {
            calls.push({ model, op, args });
            if (model === "city") return cities;
            if (model === "neighbourhood") return neighbourhoods;
            return [];
          },
        },
      ),
  },
);

vi.mock("@/lib/db", () => ({ db, auditClient: {} }));

const { listCityChoices, listNeighbourhoodChoices } = await import(
  "@/modules/geography/queries"
);

/** The sentinel `lib/scope.ts` uses to mean "match nothing". */
const NO_MATCH = "__none__";

function reader(schoolId: string | null = "school-1"): AuthContext {
  return {
    organization: { id: "org-1" },
    currentSchool: schoolId ? { id: schoolId } : null,
    currentSchoolYear: { id: "year-1" },
    user: { id: "user-1" },
    can: () => true,
    canOrg: () => true,
    canInSchool: () => true,
  } as unknown as AuthContext;
}

const whereOf = () =>
  (calls[0]!.args as { where: Record<string, unknown> }).where;

beforeEach(() => {
  calls.length = 0;
  cities = [{ id: "city-1", name: "Oujda", nameAr: "وجدة" }];
  neighbourhoods = [
    {
      id: "quartier-1",
      name: "Centre-ville",
      city: { id: "city-1", name: "Oujda" },
    },
  ];
});

// ── Scoping ──────────────────────────────────────────────────────────────────

describe("scoping", () => {
  it("offers a school its own towns", async () => {
    await listCityChoices(reader());
    expect(whereOf()["schoolId"]).toBe("school-1");
  });

  it("offers a school its own quartiers", async () => {
    await listNeighbourhoodChoices(reader());
    expect(whereOf()["schoolId"]).toBe("school-1");
  });

  it("offers nothing with no school in context", async () => {
    // The first login, or a membership just revoked.
    await listCityChoices(reader(null));
    expect(whereOf()["schoolId"]).toBe(NO_MATCH);

    calls.length = 0;
    await listNeighbourhoodChoices(reader(null));
    expect(whereOf()["schoolId"]).toBe(NO_MATCH);
  });

  it("keeps the school clause alongside the active filter, never instead of it", async () => {
    // A kept id from another school must still not appear: the school is ANDed
    // with the OR, not replaced by it.
    await listCityChoices(reader(), ["city-elsewhere"]);
    const where = whereOf();

    expect(where["schoolId"]).toBe("school-1");
    expect(where["OR"]).toBeDefined();
  });
});

// ── The rule that stops a silent loss ────────────────────────────────────────

describe("keeping what is already on the row", () => {
  it("offers active towns only when nothing is being edited", async () => {
    // A new pupil has no existing value to preserve.
    await listCityChoices(reader());
    expect(whereOf()).toMatchObject({ isActive: true });
    expect(whereOf()).not.toHaveProperty("OR");
  });

  it("keeps a deactivated town that the row still carries", async () => {
    // Merging two spellings deactivates the loser, and a form that dropped it
    // would blank the birthplace of everyone born there the next time somebody
    // pressed Save.
    await listCityChoices(reader(), ["city-merged-away"]);

    expect(whereOf()).toMatchObject({
      OR: [{ isActive: true }, { id: { in: ["city-merged-away"] } }],
    });
    expect(whereOf()).not.toHaveProperty("isActive");
  });

  it("keeps a deactivated quartier the same way", async () => {
    await listNeighbourhoodChoices(reader(), ["quartier-retired"]);
    expect(whereOf()).toMatchObject({
      OR: [{ isActive: true }, { id: { in: ["quartier-retired"] } }],
    });
  });

  it("ignores a blank where a row simply has no value", async () => {
    // `Student.birthCityId` is nullable, and a null must not become a filter.
    await listCityChoices(reader(), [null, undefined as unknown as null]);
    expect(whereOf()).toMatchObject({ isActive: true });
    expect(whereOf()).not.toHaveProperty("OR");
  });

  it("keeps several at once, for a form carrying more than one", async () => {
    await listNeighbourhoodChoices(reader(), ["a", null, "b"]);
    expect(whereOf()).toMatchObject({
      OR: [{ isActive: true }, { id: { in: ["a", "b"] } }],
    });
  });
});

// ── The labels ───────────────────────────────────────────────────────────────

describe("what a picker shows", () => {
  it("carries both spellings of a town", async () => {
    // So a secretary working in French and a director reading the Arabic
    // paperwork recognise the same row.
    const choices = await listCityChoices(reader());
    expect(choices[0]!.label).toBe("Oujda — وجدة");
  });

  it("falls back to the one spelling a town has", async () => {
    cities = [{ id: "city-2", name: "Berkane", nameAr: null }];
    const choices = await listCityChoices(reader());
    expect(choices[0]!.label).toBe("Berkane");
  });

  it("names a quartier with its town", async () => {
    // Two towns can each have a "Centre-ville", and a bare list of quartier
    // names makes those two rows indistinguishable at the moment of choosing.
    const choices = await listNeighbourhoodChoices(reader());
    expect(choices[0]!.label).toBe("Oujda · Centre-ville");
  });

  it("carries the town alongside the label, not only inside it", async () => {
    // So a dropdown can *group* by it: a school serving more than one town
    // otherwise gave a secretary one flat run of names to scroll, with the five
    // that applied to the child somewhere in the middle.
    const choices = await listNeighbourhoodChoices(reader());
    expect(choices[0]).toMatchObject({
      cityId: "city-1",
      cityName: "Oujda",
    });
  });

  it("orders the quartiers by town, then by name", async () => {
    await listNeighbourhoodChoices(reader());
    expect(calls[0]!.args).toMatchObject({
      orderBy: [{ city: { name: "asc" } }, { name: "asc" }],
    });
  });

  it("orders the towns by name", async () => {
    await listCityChoices(reader());
    expect(calls[0]!.args).toMatchObject({ orderBy: [{ name: "asc" }] });
  });

  it("groups rather than filters, because the quartier is the address", async () => {
    // There is no *residence* town on a pupil to filter by —
    // `Student.birthCityId` is where the child was born, and narrowing the
    // address list by it would hide the right quartier for every child born
    // somewhere other than where they live. So the list stays complete.
    await listNeighbourhoodChoices(reader());
    expect(whereOf()).not.toHaveProperty("cityId");
    expect(whereOf()).not.toHaveProperty("city");
  });

  it("answers an empty list for a school with no towns declared", async () => {
    cities = [];
    expect(await listCityChoices(reader())).toEqual([]);
  });
});

// ── The rooms, which are the other reference list ────────────────────────────

describe("the room kinds", () => {
  it("names the kinds a school actually has", () => {
    expect(new Set(ROOM_KINDS).size).toBe(ROOM_KINDS.length);
    expect(ROOM_KINDS.length).toBeGreaterThan(0);
  });

  it("marks the ones a practical lesson needs", () => {
    // The timetable reads this to know a TP cannot be placed in an ordinary
    // classroom.
    for (const kind of LAB_ROOM_KINDS) {
      expect(ROOM_KINDS, kind).toContain(kind);
    }
  });

  it("does not call every room a lab", () => {
    expect(LAB_ROOM_KINDS.length).toBeLessThan(ROOM_KINDS.length);
  });
});
