import { describe, expect, it, vi } from "vitest";

import { RESOURCES, findResource } from "@/modules/configuration/resources";
import { getDictionaryFor } from "@/lib/i18n/server";
import type { AuthContext } from "@/lib/dal";

/**
 * The generic configuration CRUD.
 *
 * One create, one update and one delete stand behind every configuration table
 * in the app, and the resource they act on arrives in a form field. That is the
 * shape of a mass-assignment bug and of an arbitrary-table write, so what is
 * tested here is not the CRUD but the four things that keep it from being one:
 *
 *   1. `__resource` resolves against a declared registry, so it can only ever
 *      name a table somebody wrote down.
 *   2. `readResourceForm` reads *only* the fields the descriptor declares, so a
 *      submitted `organizationId` or `isSystem` is never even looked at.
 *   3. Every resource's `where(context)` confines the write to the school or
 *      year in context.
 *   4. With nothing in context, that clause matches **nothing** rather than
 *      everything — which is the difference between an empty screen and an
 *      `updateMany` across the deployment.
 */

// The schema half imports Prisma; the delegates are never called here, only the
// `where` functions, so a bare stand-in is enough.
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: () => ({}) }), auditClient: {} }));

const { RESOURCE_SCHEMAS, resourceSchema } = await import(
  "@/modules/configuration/resource-schema"
);
const { readResourceForm, resourceSchemaFor } = await import(
  "@/modules/configuration/validation"
);

/** The sentinel `lib/scope.ts` uses to mean "match nothing". */
const NO_MATCH = "__none__";

function contextWith(
  schoolId: string | null,
  schoolYearId: string | null,
): AuthContext {
  return {
    organization: { id: "org-1" },
    currentSchool: schoolId ? { id: schoolId } : null,
    currentSchoolYear: schoolYearId ? { id: schoolYearId } : null,
  } as unknown as AuthContext;
}

/** Every string appearing anywhere in a nested `where` clause. */
function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(stringsIn);
  }
  return [];
}

// ── The registry ─────────────────────────────────────────────────────────────

describe("the resource registry", () => {
  it("gives every declared resource a database half", () => {
    // A resource with no schema is the bug the `school-settings` note records:
    // saving appeared to work while the form redrew its defaults for ever,
    // because the read resolved through `resourceSchema` and got undefined.
    for (const resource of RESOURCES) {
      expect(resourceSchema(resource.id), `${resource.id} has no schema`).toBeDefined();
    }
  });

  it("declares no database half for a resource nobody can reach", () => {
    const declared = new Set(RESOURCES.map((resource) => resource.id));
    for (const id of Object.keys(RESOURCE_SCHEMAS)) {
      expect(declared.has(id), `${id} has a schema but no descriptor`).toBe(true);
    }
  });

  it("gives every resource a distinct id", () => {
    const ids = RESOURCES.map((resource) => resource.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves only ids that exist", () => {
    for (const resource of RESOURCES) {
      expect(findResource(resource.id)?.id).toBe(resource.id);
    }
    for (const nonsense of [
      "",
      "users",
      "User",
      "__proto__",
      "constructor",
      "toString",
      "../users",
      "school-settings ",
    ]) {
      expect(findResource(nonsense), nonsense).toBeUndefined();
    }
  });

  it("has no schema reachable through the prototype chain", () => {
    // `RESOURCE_SCHEMAS` is a plain object, so a lookup of "constructor" would
    // otherwise return a function and sail past a truthiness check.
    for (const key of ["__proto__", "constructor", "toString", "valueOf"]) {
      expect(resourceSchema(key), key).toBeUndefined();
    }
  });
});

// ── Scoping ──────────────────────────────────────────────────────────────────

describe("every resource's where clause", () => {
  const entries = Object.entries(RESOURCE_SCHEMAS);

  it("is not empty for any resource", () => {
    // An empty clause on an `updateMany` or a `deleteMany` is every row in the
    // table, for every school in the deployment.
    const context = contextWith("school-1", "year-1");
    for (const [id, schema] of entries) {
      const where = schema.where(context);
      expect(Object.keys(where).length, `${id} is unscoped`).toBeGreaterThan(0);
    }
  });

  it("names the school or the year in context", () => {
    const context = contextWith("school-1", "year-1");
    for (const [id, schema] of entries) {
      const values = stringsIn(schema.where(context));
      expect(
        values.includes("school-1") || values.includes("year-1"),
        `${id} does not mention the working context`,
      ).toBe(true);
    }
  });

  it("matches nothing when no school is in context", () => {
    // The first login, or a user whose only membership was just revoked. The
    // sentinel is what makes every list come back empty and every crafted id
    // match no rows — an `undefined` would drop the clause and hand over the
    // whole organisation.
    const context = contextWith(null, null);
    for (const [id, schema] of entries) {
      const values = stringsIn(schema.where(context));
      expect(values, `${id} does not fall back to the sentinel`).toContain(
        NO_MATCH,
      );
    }
  });

  it("matches nothing for a year-scoped resource with no year in context", () => {
    const context = contextWith("school-1", null);
    for (const [id, schema] of entries) {
      const values = stringsIn(schema.where(context));
      const scopedToYear = !values.includes("school-1");
      if (scopedToYear) {
        expect(values, `${id} leaks without a year`).toContain(NO_MATCH);
      }
    }
  });

  it("changes what it matches when the school changes", () => {
    // Which is what makes switching school in the header genuinely change what
    // the screen manages.
    for (const [id, schema] of entries) {
      const a = JSON.stringify(schema.where(contextWith("school-a", "year-a")));
      const b = JSON.stringify(schema.where(contextWith("school-b", "year-b")));
      expect(a, `${id} ignores the working context`).not.toBe(b);
    }
  });
});

// ── Mass assignment ──────────────────────────────────────────────────────────

describe("readResourceForm", () => {
  const resource = findResource("cities")!;

  it("reads the fields the descriptor declares", () => {
    const form = new FormData();
    for (const field of resource.fields) form.set(field.name, "value");

    const values = readResourceForm(resource, form);
    for (const field of resource.fields) {
      expect(values).toHaveProperty(field.name);
    }
  });

  it("ignores every field the descriptor does not declare", () => {
    // The whole mass-assignment guard, and it is a *positive* loop over the
    // descriptor rather than a denylist — so a column added to a table is not
    // writable until somebody declares it here.
    const form = new FormData();
    form.set("name", "Casablanca");
    form.set("id", "some-other-row");
    form.set("schoolId", "another-school");
    form.set("organizationId", "another-org");
    form.set("isSystem", "on");
    form.set("createdAt", "1970-01-01");

    const values = readResourceForm(resource, form);
    const declared = new Set(resource.fields.map((field) => field.name));

    for (const key of Object.keys(values)) {
      expect(declared.has(key), `${key} was read but never declared`).toBe(true);
    }
    expect(values).not.toHaveProperty("schoolId");
    expect(values).not.toHaveProperty("organizationId");
    expect(values).not.toHaveProperty("isSystem");
  });

  it("reads an absent field as blank rather than leaving it undefined", () => {
    const values = readResourceForm(resource, new FormData());
    for (const field of resource.fields) {
      expect(values[field.name], field.name).not.toBeUndefined();
    }
  });

  it("reads an unticked checkbox as false, not as absent", () => {
    for (const target of RESOURCES) {
      const boolean = target.fields.find((field) => field.type === "boolean");
      if (!boolean) continue;
      const values = readResourceForm(target, new FormData());
      expect(values[boolean.name]).toBe(false);
      break;
    }
  });

  it("trims what it reads", () => {
    const form = new FormData();
    form.set("name", "  Casablanca  ");
    expect(readResourceForm(resource, form)["name"]).toBe("Casablanca");
  });

  it("answers blank for a File where a string was expected", () => {
    const form = new FormData();
    form.set("name", new File(["x"], "x.png"));
    expect(readResourceForm(resource, form)["name"]).toBe("");
  });
});

// ── The field descriptors themselves ─────────────────────────────────────────

describe("field descriptors", () => {
  it("give every reference field something to point at", () => {
    // `findUnreachableReference` fails closed on an unknown target, so a
    // reference with no `referenceTo` would make its resource unsaveable.
    for (const resource of RESOURCES) {
      for (const field of resource.fields) {
        if (field.type !== "reference") continue;
        expect(field.referenceTo, `${resource.id}.${field.name}`).toBeTruthy();
      }
    }
  });

  it("point every reference at a real resource or a declared loader", () => {
    const loaders = new Set(["@teachers", "@slots"]);
    for (const resource of RESOURCES) {
      for (const field of resource.fields) {
        if (field.type !== "reference" || !field.referenceTo) continue;
        const target = field.referenceTo;
        expect(
          loaders.has(target) || Boolean(resourceSchema(target)),
          `${resource.id}.${field.name} points at ${target}`,
        ).toBe(true);
      }
    }
  });

  it("give every select something to choose from", () => {
    for (const resource of RESOURCES) {
      for (const field of resource.fields) {
        if (field.type !== "select" && field.type !== "multiselect") continue;
        expect(
          field.options?.length,
          `${resource.id}.${field.name} has no options`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("name each field once per resource", () => {
    for (const resource of RESOURCES) {
      const names = resource.fields.map((field) => field.name);
      expect(new Set(names).size, resource.id).toBe(names.length);
    }
  });

  it("never declare a field the write path injects itself", () => {
    // `schoolId`, `schoolYearId` and `id` come from the authorized context or
    // the row being edited. Declaring one as a field would make it editable
    // from the form, which is the cross-tenant write the `where` clause exists
    // to prevent.
    const injected = ["id", "schoolId", "schoolYearId", "organizationId"];
    for (const resource of RESOURCES) {
      for (const field of resource.fields) {
        expect(
          injected,
          `${resource.id} declares ${field.name} as editable`,
        ).not.toContain(field.name);
      }
    }
  });
});

// ── The generated zod schema ─────────────────────────────────────────────────

describe("resourceSchemaFor", () => {
  const dictionary = getDictionaryFor("en");
  const resource = findResource("cities")!;

  /** A complete, valid submission, built the way the action builds one. */
  function submission(extra: Record<string, string> = {}) {
    const form = new FormData();
    form.set("code", "CASA");
    form.set("name", "Casablanca");
    form.set("nameAr", "الدار البيضاء");
    form.set("region", "Casablanca-Settat");
    form.set("isActive", "on");
    for (const [key, value] of Object.entries(extra)) form.set(key, value);
    return { form, values: readResourceForm(resource, form) };
  }

  it("accepts a well-formed submission", () => {
    const { values } = submission();
    expect(resourceSchemaFor(resource, dictionary).safeParse(values).success).toBe(
      true,
    );
  });

  it("strips anything the descriptor did not declare", () => {
    // Belt and braces behind `readResourceForm`: zod objects drop unknown keys,
    // so a value that somehow reached the parser still cannot reach the table.
    const { values } = submission();
    const parsed = resourceSchemaFor(resource, dictionary).safeParse({
      ...values,
      schoolId: "another-school",
      organizationId: "another-org",
      isSystem: true,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("schoolId");
      expect(parsed.data).not.toHaveProperty("organizationId");
      expect(parsed.data).not.toHaveProperty("isSystem");
    }
  });

  it("refuses a submission missing a required field", () => {
    const form = new FormData();
    form.set("name", "Casablanca");
    const parsed = resourceSchemaFor(resource, dictionary).safeParse(
      readResourceForm(resource, form),
    );
    expect(parsed.success).toBe(false);
  });

  it("refuses a value past the declared length", () => {
    const { values } = submission({ code: "C".repeat(33) });
    expect(
      resourceSchemaFor(resource, dictionary).safeParse(values).success,
    ).toBe(false);
  });
});
