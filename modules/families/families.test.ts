import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/permissions";
import { getDictionaryFor } from "@/lib/i18n/server";
import {
  FAMILY_SITUATIONS,
  GUARDIAN_RELATIONSHIPS,
  SINGULAR_RELATIONSHIPS,
  isSingularRelationship,
} from "@/modules/families/enums";
import { familySchema, guardianSchema } from "@/modules/families/validation";

/**
 * Le dossier familial: the adults a school rings, and what each may do.
 *
 * Two things make this module worth its own tests.
 *
 * **A dossier must always have somebody to ring.** `isPrimaryContact` is at
 * most one per family, and SQLite cannot say so — no partial unique index —
 * so every write that sets it has to clear the others first and put one back
 * afterwards. A rule enforced by three cooperating statements is a rule that
 * breaks on the path nobody walked.
 *
 * **What an adult *is* and what an adult *may do* are separate columns.** A
 * custody order can take the gate away from a father, so `canPickUp`,
 * `isEmergencyContact` and the first-contact flag are never derived from
 * `relationship`. That is the distinction a secretary at the gate acts on.
 */

const t = getDictionaryFor("en");

// ─────────────────────────────────────────────────────────────────────────────

type GuardianRow = {
  id: string;
  familyId: string;
  relationship: string;
  isPrimaryContact: boolean;
  isActive: boolean;
};

const families = new Map<string, { id: string; schoolId: string; code: string }>();
const guardians = new Map<string, GuardianRow>();
const familyWrites: { id: string; data: Record<string, unknown> }[] = [];
const guardianWrites: { where: unknown; data: Record<string, unknown> }[] = [];
const demotions: unknown[] = [];

const SCHOOL = "school-1";

function seed() {
  families.clear();
  guardians.clear();
  familyWrites.length = 0;
  guardianWrites.length = 0;
  demotions.length = 0;

  families.set("family-1", { id: "family-1", schoolId: SCHOOL, code: "F-2026-0042" });
  families.set("family-2", { id: "family-2", schoolId: SCHOOL, code: "F-2026-0043" });
  // Another school's dossier, so a crafted id has something to reach.
  families.set("foreign", { id: "foreign", schoolId: "school-2", code: "F-X" });

  guardians.set("mother-1", {
    id: "mother-1",
    familyId: "family-1",
    relationship: "MOTHER",
    isPrimaryContact: true,
    isActive: true,
  });
  guardians.set("father-1", {
    id: "father-1",
    familyId: "family-1",
    relationship: "FATHER",
    isPrimaryContact: false,
    isActive: true,
  });
  // A guardian on a different dossier of the same school.
  guardians.set("mother-2", {
    id: "mother-2",
    familyId: "family-2",
    relationship: "MOTHER",
    isPrimaryContact: true,
    isActive: true,
  });
}

const matchesGuardian = (
  row: GuardianRow,
  where: Record<string, unknown>,
): boolean => {
  if (where["id"] !== undefined && where["id"] !== row.id) return false;
  if (where["familyId"] !== undefined && where["familyId"] !== row.familyId) {
    return false;
  }
  if (
    where["relationship"] !== undefined &&
    where["relationship"] !== row.relationship
  ) {
    return false;
  }
  if (
    where["isPrimaryContact"] !== undefined &&
    where["isPrimaryContact"] !== row.isPrimaryContact
  ) {
    return false;
  }
  if (where["isActive"] !== undefined && where["isActive"] !== row.isActive) {
    return false;
  }
  const not = where["NOT"] as { id?: string } | undefined;
  if (not?.id && not.id === row.id) return false;
  return true;
};

vi.mock("@/lib/db", () => ({
  db: {
    family: {
      findUnique: async ({ where }: { where: { id?: string } }) =>
        (where.id ? families.get(where.id) : null) ?? null,
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        familyWrites.push({ id: "new-family", data });
        return { id: "new-family" };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        familyWrites.push({ id: where.id, data });
        return { id: where.id };
      },
      delete: async ({ where }: { where: { id: string } }) => {
        families.delete(where.id);
        return { id: where.id };
      },
    },
    guardian: {
      findUnique: async ({ where }: { where: { id?: string } }) => {
        const row = where.id ? guardians.get(where.id) : undefined;
        if (!row) return null;
        const family = families.get(row.familyId)!;
        return { ...row, family: { schoolId: family.schoolId } };
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        [...guardians.values()].find((row) => matchesGuardian(row, where)) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        guardianWrites.push({ where: null, data });
        return { id: "new-guardian" };
      },
      update: async ({
        where,
        data,
      }: {
        where: unknown;
        data: Record<string, unknown>;
      }) => {
        guardianWrites.push({ where, data });
        return {};
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        // The demotion sweep and the guardian edit share this call. The sweep
        // writes exactly one column; an edit writes the whole guardian.
        if (
          Object.keys(data).length === 1 &&
          data["isPrimaryContact"] === false
        ) {
          demotions.push(where);
          return { count: 1 };
        }
        guardianWrites.push({ where, data });
        const hit = [...guardians.values()].filter((row) =>
          matchesGuardian(row, where),
        );
        return { count: hit.length };
      },
      delete: async ({ where }: { where: { id: string } }) => {
        guardians.delete(where.id);
        return { id: where.id };
      },
    },
    student: { count: async () => 0 },
  },
  auditClient: {},
}));

vi.mock("@/lib/audit", () => ({ recordEvent: async () => {} }));

const granted = new Set<string>();
const asked: string[] = [];
let schoolInContext: string | null = SCHOOL;

class ForbiddenError extends Error {
  readonly permission?: string;
  constructor(permission?: string) {
    super(permission ? `Missing permission: ${permission}` : "Forbidden");
    this.permission = permission;
    this.name = "ForbiddenError";
  }
}

vi.mock("@/lib/dal", () => ({
  ForbiddenError,
  requireAuth: async () => ({
    organization: { id: "org-1" },
    currentSchool: schoolInContext ? { id: schoolInContext } : null,
    currentSchoolYear: { id: "year-1" },
    user: { id: "user-1" },
    can: (code: string) => granted.has(code),
    canOrg: (code: string) => granted.has(code),
    canInSchool: (_school: string, code: string) => granted.has(code),
  }),
  authorizeSchool: async (schoolId: string, permission: string) => {
    asked.push(`${permission}@${schoolId}`);
    if (!granted.has(permission)) throw new ForbiddenError(permission);
    // The school the row belongs to decides — a caller working elsewhere is
    // still refused.
    if (schoolId !== SCHOOL) throw new ForbiddenError(permission);
    return { currentSchool: { id: schoolId } };
  },
}));

vi.mock("@/lib/i18n/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/server")>()),
  getDictionary: async () => t,
}));

vi.mock("next/cache", () => ({ refresh: () => {} }));

const {
  deleteGuardianAction,
  saveGuardianAction,
  setPrimaryContactAction,
  updateFamilyAction,
} = await import("@/modules/families/actions");

const IDLE = { status: "idle" } as never;

function familyForm(extra: Record<string, string> = {}) {
  const form = new FormData();
  form.set("id", "family-1");
  form.set("code", "F-2026-0042");
  form.set("name", "Benali");
  form.set("situation", "MARRIED");
  form.set("country", "MA");
  form.set("isActive", "on");
  for (const [key, value] of Object.entries(extra)) form.set(key, value);
  return form;
}

function guardianForm(extra: Record<string, string> = {}) {
  const form = new FormData();
  form.set("familyId", "family-1");
  form.set("relationship", "GRANDMOTHER");
  form.set("firstName", "Fatima");
  form.set("lastName", "Benali");
  form.set("canPickUp", "on");
  form.set("isActive", "on");
  for (const [key, value] of Object.entries(extra)) form.set(key, value);
  return form;
}

beforeEach(() => {
  seed();
  asked.length = 0;
  schoolInContext = SCHOOL;
  granted.clear();
  granted.add(PERMISSIONS.FAMILY_VIEW);
  granted.add(PERMISSIONS.FAMILY_CREATE);
  granted.add(PERMISSIONS.FAMILY_UPDATE);
  granted.add(PERMISSIONS.FAMILY_DELETE);
});

// ── The dossier number ───────────────────────────────────────────────────────

describe("updateFamilyAction", () => {
  it("keeps the dossier number when the form leaves it blank", async () => {
    // The bug this closes. Allocation belongs to *opening* a file; on an edit it
    // renumbered the dossier, so a secretary who cleared the field — or any
    // request that simply did not carry it — walked away with a family filed
    // under a different number from the one on every piece of paper they had
    // already been given.
    const state = await updateFamilyAction(IDLE, familyForm({ code: "" }));

    expect(state.status).toBe("success");
    expect(familyWrites[0]!.data["code"]).toBe("F-2026-0042");
  });

  it("takes a number the form does give it", async () => {
    await updateFamilyAction(IDLE, familyForm({ code: "F-2026-9999" }));
    expect(familyWrites[0]!.data["code"]).toBe("F-2026-9999");
  });

  it("authorizes against the school the dossier belongs to", async () => {
    // The id is only ever used to *find* the row; what the caller may do with
    // it is decided by the school it turns out to be in.
    await updateFamilyAction(IDLE, familyForm());
    expect(asked).toEqual([`${PERMISSIONS.FAMILY_UPDATE}@${SCHOOL}`]);
  });

  it("refuses a dossier of another school", async () => {
    const state = await updateFamilyAction(IDLE, familyForm({ id: "foreign" }));
    expect(state.status).toBe("error");
    expect(familyWrites).toEqual([]);
  });

  it("refuses an id nobody declared", async () => {
    const state = await updateFamilyAction(IDLE, familyForm({ id: "nowhere" }));
    expect(state.status).toBe("error");
    expect(familyWrites).toEqual([]);
  });

  it("refuses somebody without the code", async () => {
    granted.delete(PERMISSIONS.FAMILY_UPDATE);
    const state = await updateFamilyAction(IDLE, familyForm());
    expect(state.status).toBe("error");
    expect(familyWrites).toEqual([]);
  });

  it("never lets the school travel in the form", async () => {
    const form = familyForm();
    form.set("schoolId", "school-2");
    await updateFamilyAction(IDLE, form);
    expect(familyWrites[0]!.data).not.toHaveProperty("schoolId");
  });
});

// ── Somebody to ring ─────────────────────────────────────────────────────────

describe("saveGuardianAction", () => {
  it("adds a guardian to the dossier", async () => {
    const state = await saveGuardianAction(IDLE, guardianForm());
    expect(state.status).toBe("success");
    expect(guardianWrites[0]!.data).toMatchObject({
      relationship: "GRANDMOTHER",
      familyId: "family-1",
    });
  });

  it("demotes nobody until the guardian has been resolved", async () => {
    // The bug this closes. Promoting a first contact clears whoever held it,
    // and that ran ahead of the write — so a `guardianId` from another dossier
    // demoted this family's first contact and *then* reported not-found. The
    // repair sits after the early return and never ran, leaving the file in the
    // one state the whole rule exists to prevent: nobody to ring.
    const state = await saveGuardianAction(
      IDLE,
      guardianForm({ id: "mother-2", isPrimaryContact: "on" }),
    );

    expect(state.status).toBe("error");
    expect(demotions).toEqual([]);
  });

  it("refuses a guardian id that does not exist", async () => {
    const state = await saveGuardianAction(
      IDLE,
      guardianForm({ id: "nowhere", isPrimaryContact: "on" }),
    );
    expect(state.status).toBe("error");
    expect(demotions).toEqual([]);
  });

  it("still demotes the others when the promotion is real", async () => {
    // The fix must not cost the rule it protects.
    await saveGuardianAction(
      IDLE,
      guardianForm({ id: "father-1", isPrimaryContact: "on" }),
    );
    expect(demotions).toHaveLength(1);
    expect(demotions[0]).toMatchObject({
      familyId: "family-1",
      NOT: { id: "father-1" },
    });
  });

  it("demotes everybody when a new guardian arrives as first contact", async () => {
    // No id to keep, so the sweep is unqualified and the new row carries the
    // flag in.
    await saveGuardianAction(IDLE, guardianForm({ isPrimaryContact: "on" }));
    expect(demotions[0]).not.toHaveProperty("NOT");
  });

  it("demotes nobody when the flag was not set", async () => {
    await saveGuardianAction(IDLE, guardianForm());
    expect(demotions).toEqual([]);
  });

  it("refuses a second mother", async () => {
    // At most one father and one mother; everything else may repeat.
    const state = await saveGuardianAction(
      IDLE,
      guardianForm({ relationship: "MOTHER" }),
    );
    expect(state.status).toBe("error");
    expect(guardianWrites).toEqual([]);
  });

  it("accepts a second grandmother", async () => {
    // A child can have two, and an uncle and an aunt besides.
    await saveGuardianAction(IDLE, guardianForm({ relationship: "GRANDMOTHER" }));
    const state = await saveGuardianAction(
      IDLE,
      guardianForm({ relationship: "GRANDMOTHER" }),
    );
    expect(state.status).toBe("success");
  });

  it("lets the existing mother stay the mother when edited", async () => {
    // The row being edited must not conflict with itself.
    const state = await saveGuardianAction(
      IDLE,
      guardianForm({ id: "mother-1", relationship: "MOTHER" }),
    );
    expect(state.status).toBe("success");
  });

  it("refuses a dossier of another school", async () => {
    const state = await saveGuardianAction(
      IDLE,
      guardianForm({ familyId: "foreign" }),
    );
    expect(state.status).toBe("error");
    expect(guardianWrites).toEqual([]);
  });

  it("scopes the edit by the dossier as well as the id", async () => {
    await saveGuardianAction(IDLE, guardianForm({ id: "father-1" }));
    const edit = guardianWrites.find((write) =>
      Object.hasOwn(write.data, "relationship"),
    );
    expect(edit!.where).toMatchObject({ id: "father-1", familyId: "family-1" });
  });

  it("never lets the family travel in the guardian's own fields", async () => {
    const form = guardianForm();
    form.set("userId", "somebody-elses-account");
    await saveGuardianAction(IDLE, form);

    // `Guardian.userId` is what the parent portal resolves a household by —
    // attaching an account is not something a dossier form may do.
    expect(guardianWrites[0]!.data).not.toHaveProperty("userId");
  });
});

describe("deleteGuardianAction", () => {
  it("authorizes through the guardian's own family", async () => {
    await deleteGuardianAction("father-1");
    expect(asked[0]).toBe(`${PERMISSIONS.FAMILY_UPDATE}@${SCHOOL}`);
  });

  it("refuses a guardian nobody declared", async () => {
    const state = await deleteGuardianAction("nowhere");
    expect(state.status).toBe("error");
  });

  it("refuses somebody without the code", async () => {
    granted.delete(PERMISSIONS.FAMILY_UPDATE);
    const state = await deleteGuardianAction("father-1");
    expect(state.status).toBe("error");
    expect(guardians.has("father-1")).toBe(true);
  });
});

describe("setPrimaryContactAction", () => {
  it("promotes one and demotes the rest", async () => {
    const state = await setPrimaryContactAction("father-1");

    expect(state.status).toBe("success");
    expect(demotions[0]).toMatchObject({
      familyId: "family-1",
      NOT: { id: "father-1" },
    });
  });

  it("authorizes through the guardian's family before touching anything", async () => {
    granted.delete(PERMISSIONS.FAMILY_UPDATE);
    const state = await setPrimaryContactAction("father-1");

    expect(state.status).toBe("error");
    expect(demotions).toEqual([]);
  });

  it("refuses a guardian nobody declared", async () => {
    const state = await setPrimaryContactAction("nowhere");
    expect(state.status).toBe("error");
    expect(demotions).toEqual([]);
  });
});

// ── Kinship is not permission ────────────────────────────────────────────────

describe("relationships", () => {
  it("holds at most one father and one mother, and nothing else", () => {
    // A step-parent is left repeatable rather than guessed at: a school
    // recording a second remarriage should not be stopped by a rule invented
    // here.
    expect([...SINGULAR_RELATIONSHIPS]).toEqual(["FATHER", "MOTHER"]);
    for (const relationship of GUARDIAN_RELATIONSHIPS) {
      expect(isSingularRelationship(relationship), relationship).toBe(
        relationship === "FATHER" || relationship === "MOTHER",
      );
    }
  });

  it("keeps GUARDIAN last, as the answer for anyone else", () => {
    expect(GUARDIAN_RELATIONSHIPS.at(-1)).toBe("GUARDIAN");
  });

  it("says nothing about a relationship it has never heard of", () => {
    for (const nonsense of ["", "father", "PARENT", "__proto__"]) {
      expect(isSingularRelationship(nonsense), nonsense).toBe(false);
    }
  });

  it("never derives what an adult may do from what they are", () => {
    // A custody order can take the gate away from a father, which is why
    // `canPickUp` is its own column — and why the schema refuses to compute it.
    const parsed = guardianSchema(t).safeParse({
      relationship: "FATHER",
      firstName: "Karim",
      lastName: "Benali",
      nameAr: "",
      nationalId: "",
      phone: "",
      phoneAlt: "",
      email: "",
      profession: "",
      employer: "",
      addressLine: "",
      city: "",
      isPrimaryContact: false,
      isEmergencyContact: false,
      canPickUp: false,
      notes: "",
      isActive: true,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.canPickUp).toBe(false);
      expect(parsed.data.isPrimaryContact).toBe(false);
    }
  });
});

// ── Validation ───────────────────────────────────────────────────────────────

describe("familySchema", () => {
  const form = (extra: Record<string, unknown> = {}) => ({
    code: "F-2026-0042",
    name: "Benali",
    nameAr: "",
    situation: "MARRIED",
    addressLine: "",
    city: "",
    postalCode: "",
    country: "MA",
    phone: "",
    email: "",
    notes: "",
    isActive: true,
    ...extra,
  });

  it("accepts a well-formed dossier", () => {
    expect(familySchema(t).safeParse(form()).success).toBe(true);
  });

  it("lets the code be left out, for a file being opened", () => {
    const parsed = familySchema(t).safeParse(form({ code: "" }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.code).toBeNull();
  });

  it("refuses a code that would not survive a URL or a filename", () => {
    for (const code of ["F 2026", "F/2026", "F#1", "../etc"]) {
      expect(familySchema(t).safeParse(form({ code })).success, code).toBe(false);
    }
  });

  it("accepts every situation the module declares", () => {
    for (const situation of FAMILY_SITUATIONS) {
      expect(familySchema(t).safeParse(form({ situation })).success, situation)
        .toBe(true);
    }
    for (const situation of ["", "SINGLE", "married"]) {
      expect(familySchema(t).safeParse(form({ situation })).success, situation)
        .toBe(false);
    }
  });

  it("requires a name for the dossier", () => {
    expect(familySchema(t).safeParse(form({ name: "" })).success).toBe(false);
  });

  /*
    Every dossier is filed under "Famille <nom>", whichever screen opened it.

    The rule earns tests because it rewrites what the user typed: the danger is
    not that it fails to apply but that it applies twice, so a file re-saved
    once a term ends up as "Famille Famille Benali".
  */
  it("files the dossier under Famille, whatever was typed", () => {
    const cases: [string, string][] = [
      ["Benali", "Famille Benali"],
      ["  Benali  ", "Famille Benali"],
      ["Famille Benali", "Famille Benali"],
      ["famille benali", "Famille benali"],
      ["FAMILLE Benali", "Famille Benali"],
      ["Famille   Benali", "Famille Benali"],
      // Not the word, only its letters — the surname survives intact.
      ["Famillard", "Famille Famillard"],
    ];

    for (const [typed, expected] of cases) {
      const parsed = familySchema(t).safeParse(form({ name: typed }));
      expect(parsed.success, typed).toBe(true);
      if (parsed.success) expect(parsed.data.name, typed).toBe(expected);
    }
  });

  it("does the same in Arabic, and leaves a blank Arabic name blank", () => {
    const cases: [string, string | null][] = [
      ["بنعلي", "أسرة بنعلي"],
      ["أسرة بنعلي", "أسرة بنعلي"],
      // The other Arabic word for a household, so the two do not stack.
      ["عائلة بنعلي", "أسرة بنعلي"],
      ["", null],
    ];

    for (const [typed, expected] of cases) {
      const parsed = familySchema(t).safeParse(form({ nameAr: typed }));
      expect(parsed.success, typed).toBe(true);
      if (parsed.success) expect(parsed.data.nameAr, typed).toBe(expected);
    }
  });

  it("strips anything the form did not declare", () => {
    const parsed = familySchema(t).safeParse({
      ...form(),
      schoolId: "school-2",
      id: "another-family",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("schoolId");
      expect(parsed.data).not.toHaveProperty("id");
    }
  });
});

describe("guardianSchema", () => {
  const form = (extra: Record<string, unknown> = {}) => ({
    relationship: "MOTHER",
    firstName: "Fatima",
    lastName: "Benali",
    nameAr: "",
    nationalId: "BE123456",
    phone: "0661234567",
    phoneAlt: "",
    email: "",
    profession: "",
    employer: "",
    addressLine: "",
    city: "",
    isPrimaryContact: true,
    isEmergencyContact: false,
    canPickUp: true,
    notes: "",
    isActive: true,
    ...extra,
  });

  it("accepts a well-formed guardian", () => {
    expect(guardianSchema(t).safeParse(form()).success).toBe(true);
  });

  it("requires a name, which is what a school calls them by", () => {
    expect(guardianSchema(t).safeParse(form({ firstName: "" })).success).toBe(
      false,
    );
    expect(guardianSchema(t).safeParse(form({ lastName: "" })).success).toBe(
      false,
    );
  });

  it("accepts every relationship the module declares", () => {
    for (const relationship of GUARDIAN_RELATIONSHIPS) {
      expect(
        guardianSchema(t).safeParse(form({ relationship })).success,
        relationship,
      ).toBe(true);
    }
  });

  it("refuses a relationship outside them", () => {
    for (const relationship of ["", "PARENT", "mother", "__proto__"]) {
      expect(
        guardianSchema(t).safeParse(form({ relationship })).success,
        relationship,
      ).toBe(false);
    }
  });

  it("strips the portal account, which is not a dossier field", () => {
    // `Guardian.userId` is how the parent portal resolves a household — every
    // read on a phone goes through it. Attaching an account to a family is not
    // something the dossier form may do, and zod dropping it is the guarantee.
    const parsed = guardianSchema(t).safeParse({
      ...form(),
      userId: "somebody-elses-account",
      familyId: "another-family",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("userId");
      expect(parsed.data).not.toHaveProperty("familyId");
    }
  });

  it("reads a blank optional field as null rather than empty text", () => {
    const parsed = guardianSchema(t).safeParse(
      form({ nationalId: "", phone: "", email: "" }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.nationalId).toBeNull();
      expect(parsed.data.phone).toBeNull();
      expect(parsed.data.email).toBeNull();
    }
  });

  it("refuses an address that is not one", () => {
    expect(
      guardianSchema(t).safeParse(form({ email: "not-an-address" })).success,
    ).toBe(false);
  });
});
