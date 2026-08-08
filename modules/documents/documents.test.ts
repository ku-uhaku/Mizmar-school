import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDictionaryFor } from "@/lib/i18n/server";
import {
  DOCUMENT_STATUSES,
  acceptsReceivedOn,
  dossierStandingOf,
  isSettled,
} from "@/modules/documents/enums";
import { studentDocumentSchema } from "@/modules/documents/validation";
import type { AuthContext } from "@/lib/dal";

/**
 * The dossier d'inscription.
 *
 * The module holds no file — it records whether the school has the paper — so
 * what there is to get wrong is not storage but bookkeeping, and three rules
 * carry the whole thing:
 *
 *   1. **Absence is derived.** A pupil nobody has touched has no rows and reads
 *      as missing everything. Nothing writes a MISSING row, and setting a pièce
 *      back to missing deletes rather than stores — two ways of saying the same
 *      thing eventually disagree.
 *   2. **The catalogue leads.** The checklist is built from the school's live
 *      pièces with the recorded rows joined on, not the other way round, so a
 *      pièce added on Monday is outstanding on every dossier on Tuesday.
 *   3. **A date of receipt belongs to RECEIVED and to nothing else.** A dossier
 *      that says a pièce was refused on the 12th of September is a dossier
 *      somebody will read as "we have it".
 *
 * Plus the one every module carries: both ends of a write are re-derived
 * against the school, so a crafted `studentId` or `documentTypeId` reaches
 * nothing.
 */

// ─────────────────────────────────────────────────────────────────────────────
// A recording stand-in for Prisma. Each test sets what the reads answer and
// then reads back what the writes were asked to do.
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
            if (op === "findMany") return [];
            if (op === "deleteMany") return { count: 0 };
            return null;
          },
        },
      ),
  },
);

vi.mock("@/lib/db", () => ({ db, auditClient: {} }));

const { recordDocument } = await import("@/modules/documents/service");
const { dossierStandingByStudent, listDocumentTypes, loadStudentDossier } =
  await import("@/modules/documents/queries");

/** The one call of a model/op pair, asserted to be the only one. */
function only(model: string, op: string): Call {
  const matches = calls.filter((call) => call.model === model && call.op === op);
  expect(matches, `${model}.${op}`).toHaveLength(1);
  return matches[0]!;
}

function made(model: string, op: string): boolean {
  return calls.some((call) => call.model === model && call.op === op);
}

/** The sentinel `lib/scope.ts` uses to mean "match nothing". */
const NO_MATCH = "__none__";

function contextWith(schoolId: string | null): AuthContext {
  return {
    organization: { id: "org-1" },
    currentSchool: schoolId ? { id: schoolId } : null,
    currentSchoolYear: { id: "year-1" },
    user: { id: "user-1" },
  } as unknown as AuthContext;
}

const CONTEXT = () => contextWith("school-1");

beforeEach(() => {
  calls.length = 0;
  answers = {};
});

// ── The two numbers a guichet actually asks for ──────────────────────────────

describe("dossierStandingOf", () => {
  const piece = (isRequired: boolean, status: string) => ({ isRequired, status });

  it("counts a required pièce nobody has touched as missing", () => {
    const standing = dossierStandingOf([piece(true, "MISSING")]);
    expect(standing).toMatchObject({
      missingRequired: 1,
      settledRequired: 0,
      totalRequired: 1,
      isComplete: false,
    });
  });

  it("settles a required pièce that was received", () => {
    const standing = dossierStandingOf([piece(true, "RECEIVED")]);
    expect(standing).toMatchObject({ missingRequired: 0, isComplete: true });
  });

  it("settles a waived pièce as surely as a received one", () => {
    // A child born abroad may have no acte de naissance in the Moroccan form. A
    // waiver that still read as outstanding would hold the parcours up for ever,
    // which is the whole reason EXEMPTED exists.
    const standing = dossierStandingOf([piece(true, "EXEMPTED")]);
    expect(standing).toMatchObject({ missingRequired: 0, isComplete: true });
  });

  it("does not settle a refused pièce", () => {
    // REJECTED is not MISSING — the family has already been once — but the
    // school still does not have the paper.
    const standing = dossierStandingOf([piece(true, "REJECTED")]);
    expect(standing).toMatchObject({ missingRequired: 1, isComplete: false });
  });

  it("never lets an optional pièce block", () => {
    const standing = dossierStandingOf([
      piece(true, "RECEIVED"),
      piece(false, "MISSING"),
      piece(false, "REJECTED"),
    ]);

    expect(standing.isComplete).toBe(true);
    expect(standing.missingOptional).toBe(2);
    expect(standing.totalRequired).toBe(1);
  });

  it("does not count a settled optional pièce as outstanding", () => {
    const standing = dossierStandingOf([
      piece(false, "RECEIVED"),
      piece(false, "EXEMPTED"),
    ]);
    expect(standing.missingOptional).toBe(0);
  });

  it("reads an empty catalogue as complete rather than as a checklist that never goes green", () => {
    expect(dossierStandingOf([])).toEqual({
      missingRequired: 0,
      settledRequired: 0,
      totalRequired: 0,
      missingOptional: 0,
      isComplete: true,
    });
  });

  it("keeps missing + settled equal to the total, for every mix", () => {
    // The invariant the badge at the top of the panel is built on: the two
    // numbers it shows must add up to the denominator it shows beside them.
    for (const a of DOCUMENT_STATUSES) {
      for (const b of DOCUMENT_STATUSES) {
        const standing = dossierStandingOf([piece(true, a), piece(true, b)]);
        expect(
          standing.missingRequired + standing.settledRequired,
          `${a}/${b}`,
        ).toBe(standing.totalRequired);
      }
    }
  });

  it("is complete exactly when nothing required is outstanding", () => {
    for (const a of DOCUMENT_STATUSES) {
      for (const b of DOCUMENT_STATUSES) {
        const standing = dossierStandingOf([piece(true, a), piece(false, b)]);
        expect(standing.isComplete, `${a}/${b}`).toBe(
          standing.missingRequired === 0,
        );
      }
    }
  });

  it("treats a status it has never heard of as outstanding", () => {
    // Fail closed: a value that is not in the catalogue of statuses must not
    // read as "we have it".
    const standing = dossierStandingOf([piece(true, "PROBABLY_FINE")]);
    expect(standing.isComplete).toBe(false);
  });

  it("scales without double counting", () => {
    const pieces = [
      ...Array.from({ length: 7 }, () => piece(true, "RECEIVED")),
      ...Array.from({ length: 3 }, () => piece(true, "MISSING")),
      ...Array.from({ length: 5 }, () => piece(false, "MISSING")),
    ];
    expect(dossierStandingOf(pieces)).toMatchObject({
      settledRequired: 7,
      missingRequired: 3,
      totalRequired: 10,
      missingOptional: 5,
      isComplete: false,
    });
  });
});

describe("isSettled and acceptsReceivedOn", () => {
  it("settles received and waived, and nothing else", () => {
    expect(DOCUMENT_STATUSES.filter(isSettled)).toEqual([
      "RECEIVED",
      "EXEMPTED",
    ]);
  });

  it("accepts a date of receipt for RECEIVED alone", () => {
    expect(DOCUMENT_STATUSES.filter(acceptsReceivedOn)).toEqual(["RECEIVED"]);
  });

  it("agrees with the definition the missing-documents report inlines", () => {
    // `modules/reports/runners.server.ts` filters on the two literals rather
    // than importing this. If the two ever part company, the chase-list and the
    // dossier tab would disagree about the same pupil.
    for (const status of DOCUMENT_STATUSES) {
      const inlined = status === "RECEIVED" || status === "EXEMPTED";
      expect(isSettled(status), status).toBe(inlined);
    }
  });

  it("says no to anything outside the catalogue", () => {
    for (const nonsense of ["", "received", "RECEIVED ", "__proto__", "MISSING"]) {
      expect(isSettled(nonsense), nonsense).toBe(false);
      expect(acceptsReceivedOn(nonsense), nonsense).toBe(false);
    }
  });
});

// ── What the guichet may post ────────────────────────────────────────────────

describe("studentDocumentSchema", () => {
  const dictionary = getDictionaryFor("en");
  const schema = () => studentDocumentSchema(dictionary);

  const submission = (extra: Record<string, unknown> = {}) => ({
    studentId: "student-1",
    documentTypeId: "type-1",
    status: "RECEIVED",
    receivedOn: "2026-09-15",
    reference: "AB123456",
    notes: "",
    ...extra,
  });

  it("accepts a well-formed line", () => {
    expect(schema().safeParse(submission()).success).toBe(true);
  });

  it("accepts MISSING, which is how a pièce is un-recorded", () => {
    expect(
      schema().safeParse(submission({ status: "MISSING", receivedOn: "" }))
        .success,
    ).toBe(true);
  });

  it("refuses a status outside the catalogue", () => {
    for (const status of ["", "PENDING", "received", "RECEIVED "]) {
      expect(schema().safeParse(submission({ status })).success, status).toBe(
        false,
      );
    }
  });

  it("requires both ids", () => {
    for (const key of ["studentId", "documentTypeId"]) {
      expect(
        schema().safeParse(submission({ [key]: "" })).success,
        key,
      ).toBe(false);
    }
  });

  it("refuses an id longer than any cuid, so a payload cannot be smuggled in one", () => {
    expect(
      schema().safeParse(submission({ studentId: "c".repeat(41) })).success,
    ).toBe(false);
  });

  it("reads a blank reference and note as null rather than as empty text", () => {
    const parsed = schema().safeParse(
      submission({ reference: "", notes: "   " }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.reference).toBeNull();
      expect(parsed.data.notes).toBeNull();
    }
  });

  it("refuses a note past the column's length", () => {
    expect(
      schema().safeParse(submission({ notes: "x".repeat(501) })).success,
    ).toBe(false);
    expect(
      schema().safeParse(submission({ reference: "x".repeat(61) })).success,
    ).toBe(false);
  });

  it("refuses a date it cannot read", () => {
    expect(
      schema().safeParse(submission({ receivedOn: "31/02/2026" })).success,
    ).toBe(false);
  });

  it("reads a blank date as null", () => {
    const parsed = schema().safeParse(submission({ receivedOn: "" }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.receivedOn).toBeNull();
  });

  it("strips anything the form did not declare", () => {
    const parsed = schema().safeParse({
      ...submission(),
      recordedById: "somebody-else",
      schoolId: "another-school",
      id: "another-row",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      // `recordedById` is the *caller*, taken from the session in the action. A
      // form that could name it would let one clerk sign another's name.
      expect(parsed.data).not.toHaveProperty("recordedById");
      expect(parsed.data).not.toHaveProperty("schoolId");
      expect(parsed.data).not.toHaveProperty("id");
    }
  });
});

// ── Recording one pièce ──────────────────────────────────────────────────────

const RECORDABLE = {
  "student.findFirst": { id: "student-1" },
  "documentType.findFirst": { id: "type-1" },
};

const input = (extra: Partial<Parameters<typeof recordDocument>[0]> = {}) => ({
  studentId: "student-1",
  documentTypeId: "type-1",
  status: "RECEIVED",
  receivedOn: new Date("2026-09-15"),
  reference: "AB123456",
  notes: null,
  recordedById: "user-1",
  ...extra,
});

describe("recordDocument", () => {
  it("writes the verdict against the pupil and the pièce", async () => {
    answers = { ...RECORDABLE };
    const result = await recordDocument(input(), "school-1");

    expect(result).toEqual({ ok: true });
    const upsert = only("studentDocument", "upsert").args as {
      where: unknown;
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(upsert.where).toEqual({
      studentId_documentTypeId: {
        studentId: "student-1",
        documentTypeId: "type-1",
      },
    });
    expect(upsert.update).toMatchObject({
      status: "RECEIVED",
      reference: "AB123456",
      recordedById: "user-1",
    });
  });

  it("re-derives the pupil against the school before writing", async () => {
    answers = { ...RECORDABLE };
    await recordDocument(input(), "school-1");

    expect(only("student", "findFirst").args).toMatchObject({
      where: { id: "student-1", schoolId: "school-1" },
    });
  });

  it("re-derives the pièce against the school before writing", async () => {
    answers = { ...RECORDABLE };
    await recordDocument(input(), "school-1");

    expect(only("documentType", "findFirst").args).toMatchObject({
      where: { id: "type-1", schoolId: "school-1" },
    });
  });

  it("writes nothing for a pupil of another school", async () => {
    // The crafted-id case. Not-found rather than a row that crosses two
    // tenants — which is why this is a service function and not a bare upsert.
    answers = { "documentType.findFirst": { id: "type-1" } };
    const result = await recordDocument(input(), "school-1");

    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(made("studentDocument", "upsert")).toBe(false);
    expect(made("studentDocument", "deleteMany")).toBe(false);
  });

  it("writes nothing for a pièce of another school", async () => {
    answers = { "student.findFirst": { id: "student-1" } };
    const result = await recordDocument(input(), "school-1");

    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(made("studentDocument", "upsert")).toBe(false);
  });

  it("refuses when neither end resolves", async () => {
    expect(await recordDocument(input(), "school-1")).toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(calls.filter((call) => call.model === "studentDocument")).toEqual([]);
  });

  it("uses the ids it re-derived, not the ones it was handed", async () => {
    // Belt and braces: the lookup is what decides which rows are touched, so a
    // mismatch between the two would be the bug the lookup exists to prevent.
    answers = {
      "student.findFirst": { id: "resolved-student" },
      "documentType.findFirst": { id: "resolved-type" },
    };
    await recordDocument(input(), "school-1");

    const upsert = only("studentDocument", "upsert").args as {
      create: Record<string, unknown>;
    };
    expect(upsert.create).toMatchObject({
      studentId: "resolved-student",
      documentTypeId: "resolved-type",
    });
  });

  // ── The date-of-receipt invariant ──────────────────────────────────────────

  it("keeps the date on a pièce that was received", async () => {
    answers = { ...RECORDABLE };
    await recordDocument(input(), "school-1");

    const upsert = only("studentDocument", "upsert").args as {
      update: { receivedOn: Date | null };
    };
    expect(upsert.update.receivedOn).toEqual(new Date("2026-09-15"));
  });

  it("clears the date on every status that is not RECEIVED", async () => {
    // Re-refusing a pièce that had been accepted must not leave last month's
    // date attached to the refusal — that is a dossier which claims it received
    // a document it turned away.
    for (const status of ["REJECTED", "EXEMPTED"]) {
      calls.length = 0;
      answers = { ...RECORDABLE };
      await recordDocument(input({ status }), "school-1");

      const upsert = only("studentDocument", "upsert").args as {
        update: { receivedOn: Date | null };
        create: { receivedOn: Date | null };
      };
      expect(upsert.update.receivedOn, status).toBeNull();
      expect(upsert.create.receivedOn, status).toBeNull();
    }
  });

  it("clears the date even when the form insists on one", async () => {
    // The form hides the field for a refusal, but a Server Function is reachable
    // by direct POST and the panel that draws the controls protects nothing.
    answers = { ...RECORDABLE };
    await recordDocument(
      input({ status: "REJECTED", receivedOn: new Date("2026-09-15") }),
      "school-1",
    );

    const upsert = only("studentDocument", "upsert").args as {
      update: { receivedOn: Date | null };
    };
    expect(upsert.update.receivedOn).toBeNull();
  });

  it("accepts RECEIVED with no date, which is a paper whose day nobody noted", async () => {
    answers = { ...RECORDABLE };
    const result = await recordDocument(
      input({ receivedOn: null }),
      "school-1",
    );

    expect(result).toEqual({ ok: true });
    const upsert = only("studentDocument", "upsert").args as {
      update: { receivedOn: Date | null };
    };
    expect(upsert.update.receivedOn).toBeNull();
  });

  it("writes the same data whether it creates or updates", async () => {
    // One verdict per pièce per pupil, so the second recording edits the first.
    // A create and an update that differ is how the two come to disagree.
    answers = { ...RECORDABLE };
    await recordDocument(input(), "school-1");

    const upsert = only("studentDocument", "upsert").args as {
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    for (const [key, value] of Object.entries(upsert.update)) {
      expect(upsert.create[key], key).toEqual(value);
    }
  });

  // ── MISSING is absence, and absence is not stored ──────────────────────────

  it("deletes the row rather than storing a MISSING one", async () => {
    answers = { ...RECORDABLE };
    const result = await recordDocument(
      input({ status: "MISSING" }),
      "school-1",
    );

    expect(result).toEqual({ ok: true });
    expect(only("studentDocument", "deleteMany").args).toEqual({
      where: { studentId: "student-1", documentTypeId: "type-1" },
    });
    expect(made("studentDocument", "upsert")).toBe(false);
  });

  it("un-records without complaint when there was nothing recorded", async () => {
    // The guichet correcting its own mistake, on a pièce nobody had touched.
    answers = { ...RECORDABLE, "studentDocument.deleteMany": { count: 0 } };
    expect(
      await recordDocument(input({ status: "MISSING" }), "school-1"),
    ).toEqual({ ok: true });
  });

  it("still re-derives both ends before deleting", async () => {
    answers = { "documentType.findFirst": { id: "type-1" } };
    const result = await recordDocument(
      input({ status: "MISSING" }),
      "school-1",
    );

    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(made("studentDocument", "deleteMany")).toBe(false);
  });

  it("scopes the delete by both ids, so it can never take a whole dossier", async () => {
    answers = { ...RECORDABLE };
    await recordDocument(input({ status: "MISSING" }), "school-1");

    const where = (only("studentDocument", "deleteMany").args as {
      where: Record<string, unknown>;
    }).where;
    expect(Object.keys(where).sort()).toEqual(["documentTypeId", "studentId"]);
  });

  it("records against a pièce the school has withdrawn", async () => {
    // Deliberate, and worth pinning: the lookup asks for the school, not for
    // `isActive`. Correcting a dossier recorded before a pièce was withdrawn
    // has to stay possible — the row survives, the paper is still in the drawer,
    // and it simply stops counting on the checklist.
    answers = { ...RECORDABLE };
    await recordDocument(input(), "school-1");

    const where = (only("documentType", "findFirst").args as {
      where: Record<string, unknown>;
    }).where;
    expect(where).not.toHaveProperty("isActive");
  });
});

// ── Reading a dossier ────────────────────────────────────────────────────────

const TYPE = {
  id: "type-1",
  code: "ACTE-NAISSANCE",
  name: "Acte de naissance",
  nameAr: null,
  isRequired: true,
  copies: null,
  notes: "Moins de trois mois.",
};

describe("loadStudentDossier", () => {
  it("builds the checklist from the catalogue, not from the recorded rows", async () => {
    // The rule that makes a pièce added on Monday outstanding on Tuesday.
    answers = { "documentType.findMany": [TYPE], "studentDocument.findMany": [] };
    const dossier = await loadStudentDossier(CONTEXT(), "student-1");

    expect(dossier.pieces).toHaveLength(1);
    expect(dossier.pieces[0]).toMatchObject({
      documentTypeId: "type-1",
      status: "MISSING",
      receivedOn: "",
      recordedByName: null,
    });
    expect(dossier.standing.missingRequired).toBe(1);
  });

  it("joins what has been recorded onto the pièce it belongs to", async () => {
    answers = {
      "documentType.findMany": [TYPE, { ...TYPE, id: "type-2", code: "CIN" }],
      "studentDocument.findMany": [
        {
          documentTypeId: "type-2",
          status: "RECEIVED",
          receivedOn: new Date(2026, 8, 15),
          reference: "AB123456",
          notes: null,
          recordedBy: null,
        },
      ],
    };

    const dossier = await loadStudentDossier(CONTEXT(), "student-1");
    expect(dossier.pieces[0]!.status).toBe("MISSING");
    expect(dossier.pieces[1]).toMatchObject({
      status: "RECEIVED",
      reference: "AB123456",
      receivedOn: "2026-09-15",
    });
    expect(dossier.standing).toMatchObject({
      settledRequired: 1,
      missingRequired: 1,
      isComplete: false,
    });
  });

  it("reads the date in local time, so it does not slip a day", async () => {
    // The bug `toDateInputValue` was written to close: `toISOString()` reads the
    // UTC day, and Morocco is ahead of UTC. A date read back one day early and
    // saved again makes the wrong day true.
    answers = {
      "documentType.findMany": [TYPE],
      "studentDocument.findMany": [
        {
          documentTypeId: "type-1",
          status: "RECEIVED",
          receivedOn: new Date(2026, 8, 15, 0, 30),
          reference: null,
          notes: null,
          recordedBy: null,
        },
      ],
    };

    const dossier = await loadStudentDossier(CONTEXT(), "student-1");
    expect(dossier.pieces[0]!.receivedOn).toBe("2026-09-15");
  });

  it("drops a recorded row whose pièce the school has withdrawn", async () => {
    // The catalogue leads: withdrawing a pièce stops it being asked for without
    // touching a single dossier.
    answers = {
      "documentType.findMany": [],
      "studentDocument.findMany": [
        {
          documentTypeId: "withdrawn",
          status: "RECEIVED",
          receivedOn: null,
          reference: null,
          notes: null,
          recordedBy: null,
        },
      ],
    };

    const dossier = await loadStudentDossier(CONTEXT(), "student-1");
    expect(dossier.pieces).toEqual([]);
    expect(dossier.standing.isComplete).toBe(true);
  });

  it("asks only for this school's live catalogue", async () => {
    await loadStudentDossier(CONTEXT(), "student-1");
    expect(only("documentType", "findMany").args).toMatchObject({
      where: { schoolId: "school-1", isActive: true },
    });
  });

  it("scopes the recorded rows through the pupil's school", async () => {
    // A studentId from another school matches nothing, so the dossier reads as
    // a pupil with none rather than as somebody else's papers.
    await loadStudentDossier(CONTEXT(), "student-from-elsewhere");
    expect(only("studentDocument", "findMany").args).toMatchObject({
      where: {
        studentId: "student-from-elsewhere",
        student: { schoolId: "school-1" },
      },
    });
  });

  it("matches nothing at all when no school is in context", async () => {
    // The first login, or a membership just revoked. Both clauses must carry the
    // sentinel — an undefined would drop them and hand over the organisation.
    await loadStudentDossier(contextWith(null), "student-1");

    expect(only("documentType", "findMany").args).toMatchObject({
      where: { schoolId: NO_MATCH },
    });
    expect(only("studentDocument", "findMany").args).toMatchObject({
      where: { student: { schoolId: NO_MATCH } },
    });
  });

  it("names whoever recorded the pièce", async () => {
    answers = {
      "documentType.findMany": [TYPE],
      "studentDocument.findMany": [
        {
          documentTypeId: "type-1",
          status: "RECEIVED",
          receivedOn: null,
          reference: null,
          notes: null,
          recordedBy: {
            email: "guichet@school.ma",
            profile: { firstName: "Salma", lastName: "Idrissi" },
          },
        },
      ],
    };

    const dossier = await loadStudentDossier(CONTEXT(), "student-1");
    expect(dossier.pieces[0]!.recordedByName).toBe("Salma Idrissi");
  });

  it("orders the checklist the way the catalogue is ordered", async () => {
    await loadStudentDossier(CONTEXT(), "student-1");
    expect(only("documentType", "findMany").args).toMatchObject({
      orderBy: [{ position: "asc" }, { name: "asc" }],
    });
  });

  it("agrees with dossierStandingOf about the same pieces", async () => {
    // The panel derives its own counts from the same helper, so the badge at the
    // top and the rows underneath it cannot disagree.
    answers = {
      "documentType.findMany": [
        TYPE,
        { ...TYPE, id: "type-2", isRequired: false },
      ],
      "studentDocument.findMany": [
        {
          documentTypeId: "type-1",
          status: "EXEMPTED",
          receivedOn: null,
          reference: null,
          notes: "Né à l'étranger.",
          recordedBy: null,
        },
      ],
    };

    const dossier = await loadStudentDossier(CONTEXT(), "student-1");
    expect(dossier.standing).toEqual(dossierStandingOf(dossier.pieces));
  });
});

// ── The whole list of pupils, in one pass ────────────────────────────────────

describe("dossierStandingByStudent", () => {
  it("asks the database nothing for an empty list", async () => {
    // The pupils screen calls this with whatever the filter returned. An empty
    // `in` clause is a query that reads the school's whole catalogue for nobody.
    expect(await dossierStandingByStudent(CONTEXT(), [])).toEqual({});
    expect(calls).toEqual([]);
  });

  it("answers for every pupil asked about, including those with nothing recorded", async () => {
    // A pupil with no rows must appear in the answer — an absent key would read
    // as "no dossier to chase" on the screen that exists to chase them.
    answers = {
      "documentType.findMany": [{ id: "type-1", isRequired: true }],
      "studentDocument.findMany": [
        { studentId: "a", documentTypeId: "type-1", status: "RECEIVED" },
      ],
    };

    const standing = await dossierStandingByStudent(CONTEXT(), ["a", "b"]);
    expect(Object.keys(standing).sort()).toEqual(["a", "b"]);
    expect(standing["a"]!.isComplete).toBe(true);
    expect(standing["b"]).toMatchObject({ missingRequired: 1, isComplete: false });
  });

  it("does not let one pupil's papers settle another's dossier", async () => {
    answers = {
      "documentType.findMany": [
        { id: "type-1", isRequired: true },
        { id: "type-2", isRequired: true },
      ],
      "studentDocument.findMany": [
        { studentId: "a", documentTypeId: "type-1", status: "RECEIVED" },
        { studentId: "b", documentTypeId: "type-2", status: "RECEIVED" },
      ],
    };

    const standing = await dossierStandingByStudent(CONTEXT(), ["a", "b"]);
    expect(standing["a"]).toMatchObject({ settledRequired: 1, missingRequired: 1 });
    expect(standing["b"]).toMatchObject({ settledRequired: 1, missingRequired: 1 });
  });

  it("ignores an optional pièce when deciding completeness", async () => {
    answers = {
      "documentType.findMany": [
        { id: "type-1", isRequired: true },
        { id: "type-2", isRequired: false },
      ],
      "studentDocument.findMany": [
        { studentId: "a", documentTypeId: "type-1", status: "RECEIVED" },
      ],
    };

    const standing = await dossierStandingByStudent(CONTEXT(), ["a"]);
    expect(standing["a"]).toMatchObject({ isComplete: true, missingOptional: 1 });
  });

  it("takes one pass rather than one query per pupil", async () => {
    // Several hundred children on the pupils screen: a query apiece is the
    // difference between a page and a timeout.
    const ids = Array.from({ length: 300 }, (_, index) => `student-${index}`);
    await dossierStandingByStudent(CONTEXT(), ids);

    expect(calls).toHaveLength(2);
    expect(Object.keys(await dossierStandingByStudent(CONTEXT(), ids))).toHaveLength(
      300,
    );
  });

  it("scopes both halves to the school in context", async () => {
    await dossierStandingByStudent(CONTEXT(), ["a"]);

    expect(only("documentType", "findMany").args).toMatchObject({
      where: { schoolId: "school-1", isActive: true },
    });
    expect(only("studentDocument", "findMany").args).toMatchObject({
      where: { studentId: { in: ["a"] }, student: { schoolId: "school-1" } },
    });
  });

  it("matches nothing with no school in context", async () => {
    await dossierStandingByStudent(contextWith(null), ["a"]);
    expect(only("documentType", "findMany").args).toMatchObject({
      where: { schoolId: NO_MATCH },
    });
  });

  it("agrees with loadStudentDossier about the same pupil", async () => {
    // The parcours reads this one and the dossier tab reads the other. They are
    // the two screens most likely to be open side by side.
    const types = [
      { ...TYPE, id: "type-1", isRequired: true },
      { ...TYPE, id: "type-2", isRequired: true },
    ];
    const recorded = {
      documentTypeId: "type-1",
      status: "REJECTED",
      receivedOn: null,
      reference: null,
      notes: "Illisible.",
      recordedBy: null,
    };

    answers = {
      "documentType.findMany": types,
      "studentDocument.findMany": [recorded],
    };
    const one = await loadStudentDossier(CONTEXT(), "student-1");

    calls.length = 0;
    answers = {
      "documentType.findMany": types,
      "studentDocument.findMany": [{ ...recorded, studentId: "student-1" }],
    };
    const many = await dossierStandingByStudent(CONTEXT(), ["student-1"]);

    expect(many["student-1"]).toEqual(one.standing);
  });
});

describe("listDocumentTypes", () => {
  it("offers this school's live catalogue only", async () => {
    await listDocumentTypes(CONTEXT());
    expect(only("documentType", "findMany").args).toMatchObject({
      where: { schoolId: "school-1", isActive: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    });
  });

  it("offers nothing with no school in context", async () => {
    await listDocumentTypes(contextWith(null));
    expect(only("documentType", "findMany").args).toMatchObject({
      where: { schoolId: NO_MATCH },
    });
  });
});
