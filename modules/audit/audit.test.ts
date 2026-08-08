import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/permissions";
import {
  IGNORED_FIELDS,
  MODEL_DOMAINS,
  REDACTED_FIELD_PATTERNS,
  UNAUDITED_MODELS,
  isRedacted,
} from "@/modules/audit/entities";
import {
  ACTIVITY_DOMAINS,
  SECURITY_ACTIONS,
  isSecurityAction,
} from "@/modules/audit/enums";
import type { AuthContext } from "@/lib/dal";

/**
 * The trail, and the two questions it answers.
 *
 * `audit.view` is "who changed this pupil's fee?" — an administrative question
 * asked by whoever is answerable for the data. `audit.security` is "who tried
 * to get in, and who was refused?" — which is about the people rather than the
 * records, and closer to reading a door log than reading a file. The module's
 * own words: **the second is deliberately not implied by the first.**
 *
 * That split is the thing worth testing, because it is enforced in a `where`
 * clause that a request also contributes to — and because the picker which
 * hides the security actions is a client component, so it protects nothing on
 * its own.
 *
 * The other half is the capture layer's promise: the trail is read by
 * administrators, exported, and kept for years, so a password hash in it is a
 * password hash in every backup of it.
 */

// ─────────────────────────────────────────────────────────────────────────────

type Call = { model: string; op: string; args: unknown };

const calls: Call[] = [];
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
            return op === "count" ? 0 : op === "findMany" ? [] : null;
          },
        },
      ),
  },
);

vi.mock("@/lib/db", () => ({ db, auditClient: {} }));

const {
  canReadSecurity,
  canReadTrail,
  listActivity,
  listActivityActors,
  loadRecordHistory,
  readableActions,
} = await import("@/modules/audit/queries");

/** The sentinel `lib/scope.ts` uses to mean "match nothing". */
const NO_MATCH = "__none__";

function reader(
  codes: readonly string[],
  { orgWide = false, schoolId = "school-1" as string | null } = {},
): AuthContext {
  const held = new Set(codes);
  return {
    organization: { id: "org-1" },
    currentSchool: schoolId ? { id: schoolId } : null,
    currentSchoolYear: { id: "year-1" },
    user: { id: "user-1" },
    can: (code: string) => held.has(code),
    canOrg: (code: string) => orgWide && held.has(code),
    canInSchool: (_school: string, code: string) => held.has(code),
  } as unknown as AuthContext;
}

/** The `where` the last list query was built with. */
const whereOf = () => {
  const call = calls.find((entry) => entry.op === "findMany");
  return (call!.args as { where: Record<string, unknown> }).where;
};

/** Every string appearing anywhere in a nested clause. */
function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value instanceof Date) return [];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(stringsIn);
  }
  return [];
}

beforeEach(() => {
  calls.length = 0;
  answers = {};
});

// ── The two codes ────────────────────────────────────────────────────────────

describe("who may read what", () => {
  it("shows the trail to a holder of audit.view", () => {
    expect(canReadTrail(reader([PERMISSIONS.AUDIT_VIEW]))).toBe(true);
    expect(
      canReadTrail(reader([PERMISSIONS.AUDIT_VIEW], { orgWide: true })),
    ).toBe(true);
  });

  it("shows it to nobody else", () => {
    expect(canReadTrail(reader([]))).toBe(false);
    expect(canReadTrail(reader([PERMISSIONS.AUDIT_SECURITY]))).toBe(false);
  });

  it("does not imply the security half", () => {
    // The whole reason there are two codes.
    expect(canReadSecurity(reader([PERMISSIONS.AUDIT_VIEW]))).toBe(false);
    expect(canReadSecurity(reader([PERMISSIONS.AUDIT_SECURITY]))).toBe(true);
  });

  it("offers the filter only the actions the reader may see", () => {
    const plain = readableActions(reader([PERMISSIONS.AUDIT_VIEW]));
    for (const action of SECURITY_ACTIONS) {
      expect(plain, action).not.toContain(action);
    }
    expect(plain).toContain("UPDATE");

    const full = readableActions(
      reader([PERMISSIONS.AUDIT_VIEW, PERMISSIONS.AUDIT_SECURITY]),
    );
    for (const action of SECURITY_ACTIONS) {
      expect(full, action).toContain(action);
    }
  });

  it("names the same set of security actions everywhere", () => {
    for (const action of SECURITY_ACTIONS) {
      expect(isSecurityAction(action), action).toBe(true);
    }
    for (const action of ["CREATE", "UPDATE", "DELETE", "", "__proto__"]) {
      expect(isSecurityAction(action), action).toBe(false);
    }
  });
});

// ── The scope, and the filter that must not widen it ─────────────────────────

describe("listActivity", () => {
  it("reads nothing at all without audit.view", async () => {
    const page = await listActivity(reader([]));
    expect(page.entries).toEqual([]);
    expect(page.total).toBe(0);
    // Not an empty query — no query.
    expect(calls).toEqual([]);
  });

  it("confines a school reader to their own school", async () => {
    await listActivity(reader([PERMISSIONS.AUDIT_VIEW]));
    expect(stringsIn(whereOf())).toContain("school-1");
    expect(stringsIn(whereOf())).toContain("org-1");
  });

  it("matches nothing when a school reader has no school in context", async () => {
    await listActivity(reader([PERMISSIONS.AUDIT_VIEW], { schoolId: null }));
    expect(stringsIn(whereOf())).toContain(NO_MATCH);
  });

  it("lets an org-wide reader see the whole organisation", async () => {
    await listActivity(
      reader([PERMISSIONS.AUDIT_VIEW], { orgWide: true }),
    );
    const values = stringsIn(whereOf());
    expect(values).toContain("org-1");
    expect(values).not.toContain("school-1");
  });

  it("keeps the security half out of a plain reader's trail", async () => {
    await listActivity(reader([PERMISSIONS.AUDIT_VIEW]));
    expect(JSON.stringify(whereOf())).toContain("notIn");
    for (const action of SECURITY_ACTIONS) {
      expect(stringsIn(whereOf()), action).toContain(action);
    }
  });

  it("does not restrict the actions of a reader who holds audit.security", async () => {
    await listActivity(
      reader([PERMISSIONS.AUDIT_VIEW, PERMISSIONS.AUDIT_SECURITY]),
    );
    expect(JSON.stringify(whereOf())).not.toContain("notIn");
  });

  // ── The regression ─────────────────────────────────────────────────────────

  it("does not let an action filter reach past the reader's own scope", async () => {
    // The bug this closes. Both halves of the clause name `action` — the scope
    // carries `{ notIn: SECURITY_ACTIONS }` and the filter carries whatever
    // arrived in the query string — and spread into one object the later key
    // simply won. `?action=LOGIN_FAILED` handed a holder of `audit.view` alone
    // every refused password and the address it was tried against.
    await listActivity(reader([PERMISSIONS.AUDIT_VIEW]), {
      action: "LOGIN_FAILED",
    });

    const where = whereOf();
    // The restriction survives the filter rather than being replaced by it.
    expect(JSON.stringify(where)).toContain("notIn");
    expect(JSON.stringify(where)).toContain("LOGIN_FAILED");
    // And the two are ANDed, so the query can only be narrower than the scope.
    expect(where).toHaveProperty("AND");
  });

  it("keeps every scope column out of reach of every filter", async () => {
    // ANDed rather than spread, so no filter added later can collide with a
    // scope column by sharing its name.
    await listActivity(reader([PERMISSIONS.AUDIT_VIEW]), {
      action: "LOGIN",
      actorId: "somebody",
      entity: "User",
      entityId: "user-9",
      search: "x",
    });

    const [scope] = (whereOf() as { AND: Record<string, unknown>[] }).AND;
    expect(scope).toMatchObject({
      organizationId: "org-1",
      schoolId: "school-1",
    });
    expect(scope["action"]).toHaveProperty("notIn");
  });

  it("still lets a plain reader filter the half they may read", async () => {
    // The fix must not cost the feature: filtering to UPDATE is the ordinary
    // thing somebody does on this screen.
    await listActivity(reader([PERMISSIONS.AUDIT_VIEW]), { action: "UPDATE" });
    expect(stringsIn(whereOf())).toContain("UPDATE");
  });

  it("lets a security reader filter to a refused sign-in", async () => {
    await listActivity(
      reader([PERMISSIONS.AUDIT_VIEW, PERMISSIONS.AUDIT_SECURITY]),
      { action: "LOGIN_FAILED" },
    );
    expect(stringsIn(whereOf())).toContain("LOGIN_FAILED");
  });

  it("narrows a domain to the models filed under it", async () => {
    await listActivity(reader([PERMISSIONS.AUDIT_VIEW]), { domain: "vieScolaire" });
    expect(JSON.stringify(whereOf())).toContain("Student");
  });

  it("ignores a domain nobody declared", async () => {
    await listActivity(reader([PERMISSIONS.AUDIT_VIEW]), { domain: "__proto__" });
    expect(JSON.stringify(whereOf())).not.toContain("__proto__");
  });

  it("lets an explicit entity beat the domain it sits in", async () => {
    await listActivity(reader([PERMISSIONS.AUDIT_VIEW]), {
      domain: "vieScolaire",
      entity: "Payment",
    });
    expect(JSON.stringify(whereOf())).toContain("Payment");
  });

  it("refuses to page below the first page", async () => {
    const page = await listActivity(reader([PERMISSIONS.AUDIT_VIEW]), {
      page: -5,
    });
    expect(page.page).toBe(1);
  });

  it("pages in the database, because the trail has no ceiling", async () => {
    // It grows by a line for every write anybody makes; shipping it whole is
    // the one thing that must not happen.
    await listActivity(reader([PERMISSIONS.AUDIT_VIEW]));
    const call = calls.find((entry) => entry.op === "findMany")!;
    expect(call.args).toHaveProperty("take");
    expect(call.args).toHaveProperty("skip");
  });

  it("ignores a date filter it cannot read", async () => {
    await listActivity(reader([PERMISSIONS.AUDIT_VIEW]), { from: "nonsense" });
    expect(JSON.stringify(whereOf())).not.toContain("createdAt");
  });
});

describe("the other two reads", () => {
  it("gives no history to a reader who may not read the trail", async () => {
    expect(await loadRecordHistory(reader([]), "Student", "student-1")).toEqual(
      [],
    );
    expect(calls).toEqual([]);
  });

  it("scopes a record's history the same way as the list", async () => {
    await loadRecordHistory(
      reader([PERMISSIONS.AUDIT_VIEW]),
      "Student",
      "student-1",
    );
    const values = stringsIn(whereOf());
    expect(values).toContain("school-1");
    for (const action of SECURITY_ACTIONS) {
      expect(values, action).toContain(action);
    }
  });

  it("offers no actors to a reader who may not read the trail", async () => {
    expect(await listActivityActors(reader([]))).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("reads the actor list off the trail the reader may see", async () => {
    await listActivityActors(reader([PERMISSIONS.AUDIT_VIEW]));
    expect(stringsIn(whereOf())).toContain("school-1");
  });
});

// ── What never reaches the trail ─────────────────────────────────────────────

describe("redaction", () => {
  it("catches every shape a credential column is written in", () => {
    // Matched on the field name rather than listed by column, so a future
    // `resetToken` or `apiSecret` is caught the day it is added rather than the
    // day somebody notices.
    for (const field of [
      "passwordHash",
      "password",
      "hashedPassword",
      "refreshToken",
      "tokenHash",
      "apiSecret",
      "clientSecret",
      "sessionToken",
      "resetToken",
    ]) {
      expect(isRedacted(field), field).toBe(true);
    }
  });

  it("matches whatever the casing", () => {
    for (const field of ["PasswordHash", "PASSWORD", "Token", "Secret"]) {
      expect(isRedacted(field), field).toBe(true);
    }
  });

  it("leaves ordinary columns alone", () => {
    // Redacting too much is its own failure: a trail that says "something
    // changed" is a trail nobody reads twice.
    for (const field of [
      "firstName",
      "amountCentimes",
      "status",
      "email",
      "score",
      "isActive",
    ]) {
      expect(isRedacted(field), field).toBe(false);
    }
  });

  it("anchors the hash pattern to the end, so a hashtag column is not swallowed", () => {
    expect(isRedacted("hashtag")).toBe(false);
    expect(isRedacted("passwordHash")).toBe(true);
  });

  it("redacts the real credential column this app has", () => {
    // `User.passwordHash` — the one that actually exists, matched twice over.
    expect(isRedacted("passwordHash")).toBe(true);
    expect(REDACTED_FIELD_PATTERNS.filter((p) => p.test("passwordHash")))
      .toHaveLength(2);
  });

  it("leaves the row's own clock out of a diff", () => {
    // They change on their own and say nothing — and `lastLoginAt` is recorded
    // far better by the LOGIN event than by a User update reading "one field
    // changed".
    expect([...IGNORED_FIELDS].sort()).toEqual([
      "createdAt",
      "id",
      "lastLoginAt",
      "updatedAt",
    ]);
  });
});

// ── The trail's own coverage ─────────────────────────────────────────────────

describe("what is watched", () => {
  it("never logs the log", () => {
    // Logging the log recurses.
    expect(UNAUDITED_MODELS).toContain("ActivityLog");
  });

  it("never logs the brute-force counter", () => {
    // It ticks on every keystroke of a mistyped password, while the login
    // events themselves are recorded by hand with far more to say.
    expect(UNAUDITED_MODELS).toContain("LoginAttempt");
  });

  it("files every model under a declared domain", () => {
    // Exhaustive over `Prisma.ModelName` on purpose: adding a table is a
    // compile error here until somebody says where its history is filed.
    for (const [model, domain] of Object.entries(MODEL_DOMAINS)) {
      expect(ACTIVITY_DOMAINS, `${model} → ${domain}`).toContain(domain);
    }
  });

  it("files the tables it does not log, too", () => {
    // They still need a home: `UNAUDITED_MODELS` decides what is captured, not
    // what the map covers.
    for (const model of UNAUDITED_MODELS) {
      expect(MODEL_DOMAINS, model).toHaveProperty(model);
    }
  });

  it("covers the tables whose history a school actually asks about", () => {
    for (const model of [
      "Student",
      "Enrollment",
      "EnrollmentFee",
      "Payment",
      "User",
      "Role",
      "Membership",
      "AssessmentGrade",
    ]) {
      expect(MODEL_DOMAINS, model).toHaveProperty(model);
    }
  });

  it("declares more than a handful of models, so the map is not a stub", () => {
    expect(Object.keys(MODEL_DOMAINS).length).toBeGreaterThan(40);
  });
});
