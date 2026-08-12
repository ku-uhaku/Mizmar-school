import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/permissions";
import { getDictionaryFor } from "@/lib/i18n/server";
import {
  CLOSED_STATUSES,
  OFFICE_MOVES,
  OPEN_STATUSES,
  REQUEST_STATUSES,
  canMove,
  isCancellable,
  isClosed,
  isOpen,
  isOverdue,
  suggestedReadyDate,
} from "@/modules/requests/enums";

/**
 * Les demandes de documents: a family asking the school for a paper.
 *
 * What is tested here is the handful of rules that keep the desk honest —
 *
 *   * **the workflow is a closed set of moves.** A Server Function is reachable
 *     by direct POST, so what the buttons offer protects nothing; the server
 *     refuses anything `OFFICE_MOVES` does not list, and nothing at all leaves
 *     a closed status;
 *   * **accepting names a day, refusing gives a reason.** Both are the school
 *     talking to a family, and both are useless without their payload;
 *   * **a request is filed against a child of the caller's own household.** A
 *     student id is guessable, and the route resolves it through the household
 *     before this module ever sees it — so what is checked here is the half
 *     that remains: that the *type* belongs to the pupil's school, and that the
 *     school is taken from the pupil rather than from the request;
 *   * **a family withdraws only what nobody has started on.**
 */

const t = getDictionaryFor("en");

// ─────────────────────────────────────────────────────────────────────────────

const calls: { model: string; op: string; args: unknown }[] = [];
let answers: Record<string, unknown> = {};

const db = new Proxy(
  {},
  {
    get: (_target, model: string) => {
      if (model === "$transaction") {
        return async (work: unknown) =>
          typeof work === "function"
            ? (work as (tx: unknown) => unknown)(db)
            : Promise.all(work as unknown[]);
      }
      return new Proxy(
        {},
        {
          get: (_d, op: string) => async (args: unknown) => {
            calls.push({ model, op, args });
            const key = `${model}.${op}`;
            if (key in answers) return answers[key];
            return op === "findMany"
              ? []
              : op === "findFirst" || op === "findUnique"
                ? null
                : { id: "request-new" };
          },
        },
      );
    },
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

const { cancelRequest, fileRequest, handleRequest } = await import(
  "@/modules/requests/service"
);
const { handleRequestAction } = await import("@/modules/requests/actions");

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
  asked.length = 0;
  granted.clear();
  for (const code of Object.values(PERMISSIONS)) granted.add(code);
});

// ── The workflow ─────────────────────────────────────────────────────────────

describe("the workflow", () => {
  it("declares a move table for every status, and none for the closed ones", () => {
    for (const status of REQUEST_STATUSES) {
      expect(OFFICE_MOVES[status], status).toBeDefined();
    }
    for (const status of CLOSED_STATUSES) {
      expect(OFFICE_MOVES[status], status).toHaveLength(0);
    }
  });

  it("splits every status into exactly one of open and closed", () => {
    for (const status of REQUEST_STATUSES) {
      expect(isOpen(status) !== isClosed(status), status).toBe(true);
    }
    expect(OPEN_STATUSES.length + CLOSED_STATUSES.length).toBe(
      REQUEST_STATUSES.length,
    );
  });

  it("lets the office promise a day, or just write the paper", () => {
    expect(canMove("PENDING", "ACCEPTED")).toBe(true);
    // "Or just deal with it" — a school writing an attestation while the parent
    // waits never makes an appointment.
    expect(canMove("PENDING", "READY")).toBe(true);
  });

  it("refuses to hand over a paper nobody has agreed to write", () => {
    expect(canMove("PENDING", "COLLECTED")).toBe(false);
    expect(canMove("ACCEPTED", "COLLECTED")).toBe(true);
    expect(canMove("READY", "COLLECTED")).toBe(true);
  });

  it("keeps a refusal available until the paper leaves the counter", () => {
    // The reason to refuse — unpaid fees, a child who left — is often found
    // while writing it.
    expect(canMove("PENDING", "REJECTED")).toBe(true);
    expect(canMove("ACCEPTED", "REJECTED")).toBe(true);
    expect(canMove("READY", "REJECTED")).toBe(true);
    expect(canMove("COLLECTED", "REJECTED")).toBe(false);
  });

  it("lets nothing out of a closed status", () => {
    for (const from of CLOSED_STATUSES) {
      for (const to of REQUEST_STATUSES) {
        expect(canMove(from, to), `${from} → ${to}`).toBe(false);
      }
    }
  });

  it("treats an unknown status as no moves rather than as an open door", () => {
    expect(canMove("NONSENSE", "COLLECTED")).toBe(false);
  });
});

// ── Answering one ────────────────────────────────────────────────────────────

const OPEN_REQUEST = {
  "documentRequest.findFirst": {
    id: "req-1",
    status: "PENDING",
    readyAt: null,
  },
};

describe("answering a request", () => {
  it("scopes the row by the school, never by the id alone", async () => {
    answers = { ...OPEN_REQUEST };

    await handleRequest("req-1", "school-1", {
      status: "READY",
      readyAt: null,
      officeNote: null,
      handledById: "user-1",
    });

    expect(only("documentRequest", "findFirst").args).toMatchObject({
      where: { id: "req-1", schoolId: "school-1" },
    });
  });

  it("refuses a move the workflow does not allow", async () => {
    answers = {
      "documentRequest.findFirst": {
        id: "req-1",
        status: "COLLECTED",
        readyAt: null,
      },
    };

    const result = await handleRequest("req-1", "school-1", {
      status: "READY",
      readyAt: null,
      officeNote: null,
      handledById: "user-1",
    });

    expect(result).toEqual({ ok: false, reason: "bad-move" });
    expect(of("documentRequest", "update")).toEqual([]);
  });

  it("refuses to accept without a day for the family to come", async () => {
    answers = { ...OPEN_REQUEST };

    const result = await handleRequest("req-1", "school-1", {
      status: "ACCEPTED",
      readyAt: null,
      officeNote: "Bring the livret de famille.",
      handledById: "user-1",
    });

    expect(result).toEqual({ ok: false, reason: "date-required" });
    expect(of("documentRequest", "update")).toEqual([]);
  });

  it("refuses to refuse without telling the family why", async () => {
    answers = { ...OPEN_REQUEST };

    const result = await handleRequest("req-1", "school-1", {
      status: "REJECTED",
      readyAt: null,
      // Whitespace is not a reason.
      officeNote: "   ",
      handledById: "user-1",
    });

    expect(result).toEqual({ ok: false, reason: "reason-required" });
  });

  it("clears the promised day on a refusal", async () => {
    answers = {
      "documentRequest.findFirst": {
        id: "req-1",
        status: "ACCEPTED",
        readyAt: new Date("2026-09-10"),
      },
    };

    await handleRequest("req-1", "school-1", {
      status: "REJECTED",
      readyAt: null,
      officeNote: "The dossier is incomplete.",
      handledById: "user-1",
    });

    // A date to come for a paper that will never be written is worse than none.
    expect(only("documentRequest", "update").args).toMatchObject({
      data: { status: "REJECTED", readyAt: null },
    });
  });

  it("keeps the promised day when the paper is marked ready", async () => {
    const promised = new Date("2026-09-10");
    answers = {
      "documentRequest.findFirst": {
        id: "req-1",
        status: "ACCEPTED",
        readyAt: promised,
      },
    };

    await handleRequest("req-1", "school-1", {
      status: "READY",
      readyAt: null,
      officeNote: null,
      handledById: "user-1",
    });

    // The day the family was told is still the useful fact — the office has to
    // be able to say what it promised.
    expect(only("documentRequest", "update").args).toMatchObject({
      data: { status: "READY", readyAt: promised },
    });
  });

  it("stamps collectedAt only on the hand-over", async () => {
    answers = {
      "documentRequest.findFirst": {
        id: "req-1",
        status: "READY",
        readyAt: null,
      },
    };

    await handleRequest("req-1", "school-1", {
      status: "COLLECTED",
      readyAt: null,
      officeNote: null,
      handledById: "user-1",
    });

    const data = (only("documentRequest", "update").args as {
      data: { collectedAt: Date | null };
    }).data;
    expect(data.collectedAt).toBeInstanceOf(Date);
  });

  it("does not stamp collectedAt on any other move", async () => {
    answers = { ...OPEN_REQUEST };

    await handleRequest("req-1", "school-1", {
      status: "READY",
      readyAt: null,
      officeNote: null,
      handledById: "user-1",
    });

    expect(only("documentRequest", "update").args).toMatchObject({
      data: { collectedAt: null },
    });
  });
});

describe("the action", () => {
  function form(fields: Record<string, string>): FormData {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.append(key, value);
    return data;
  }

  it("asks for REQUEST_HANDLE before touching anything", async () => {
    answers = { ...OPEN_REQUEST };

    await handleRequestAction(
      { status: "idle" },
      form({ requestId: "req-1", status: "READY", readyAt: "", officeNote: "" }),
    );

    expect(asked).toContain(PERMISSIONS.REQUEST_HANDLE);
  });

  it("refuses a caller without it, and writes nothing", async () => {
    granted.delete(PERMISSIONS.REQUEST_HANDLE);
    answers = { ...OPEN_REQUEST };

    // `withActionErrors` turns the refusal into a state the form can render
    // rather than letting it escape as a 500 — see lib/server-action.ts.
    const state = await handleRequestAction(
      { status: "idle" },
      form({ requestId: "req-1", status: "READY", readyAt: "", officeNote: "" }),
    );

    expect(state.status).toBe("error");
    expect(of("documentRequest", "update")).toEqual([]);
  });

  it("takes the school from the context, never from the form", async () => {
    answers = { ...OPEN_REQUEST };

    await handleRequestAction(
      { status: "idle" },
      form({
        requestId: "req-1",
        status: "READY",
        readyAt: "",
        officeNote: "",
        // Ignored — a crafted school id must reach no other desk.
        schoolId: "school-elsewhere",
      }),
    );

    expect(only("documentRequest", "findFirst").args).toMatchObject({
      where: { schoolId: "school-1" },
    });
  });
});

// ── Filing one ───────────────────────────────────────────────────────────────

describe("filing a request", () => {
  const INPUT = {
    studentId: "pupil-1",
    typeId: "type-1",
    copies: 2,
    reason: null,
    requestedById: "parent-1",
  };

  it("takes the school from the pupil, never from the request", async () => {
    answers = {
      "student.findUnique": { id: "pupil-1", schoolId: "school-7" },
      "documentRequestType.findFirst": { id: "type-1", requiresReason: false },
    };

    await fileRequest(INPUT);

    expect(only("documentRequest", "create").args).toMatchObject({
      data: { schoolId: "school-7", studentId: "pupil-1", status: "PENDING" },
    });
  });

  it("only accepts a paper the pupil's own school issues", async () => {
    answers = {
      "student.findUnique": { id: "pupil-1", schoolId: "school-7" },
    };

    const result = await fileRequest(INPUT);

    // Constrained by the school and by isActive, so a guessed type id from
    // another school matches nothing.
    expect(only("documentRequestType", "findFirst").args).toMatchObject({
      where: { id: "type-1", schoolId: "school-7", isActive: true },
    });
    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(of("documentRequest", "create")).toEqual([]);
  });

  it("insists on a reason for the papers that need one", async () => {
    answers = {
      "student.findUnique": { id: "pupil-1", schoolId: "school-7" },
      "documentRequestType.findFirst": { id: "type-1", requiresReason: true },
    };

    const result = await fileRequest({ ...INPUT, reason: "  " });

    expect(result).toEqual({ ok: false, reason: "reason-required" });
    expect(of("documentRequest", "create")).toEqual([]);
  });

  it("refuses a second request for a paper already in the queue", async () => {
    answers = {
      "student.findUnique": { id: "pupil-1", schoolId: "school-7" },
      "documentRequestType.findFirst": { id: "type-1", requiresReason: false },
      "documentRequest.findFirst": { id: "req-existing" },
    };

    const result = await fileRequest(INPUT);

    // Only the open ones count — a family may perfectly well need a second
    // attestation in March.
    expect(only("documentRequest", "findFirst").args).toMatchObject({
      where: { status: { in: ["PENDING", "ACCEPTED", "READY"] } },
    });
    expect(result).toEqual({ ok: false, reason: "duplicate" });
    expect(of("documentRequest", "create")).toEqual([]);
  });

  it("says nothing about a pupil that does not exist", async () => {
    const result = await fileRequest(INPUT);
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });
});

// ── Withdrawing one ──────────────────────────────────────────────────────────

describe("withdrawing a request", () => {
  it("is offered only while nobody has started on it", () => {
    expect(isCancellable("PENDING")).toBe(true);
    for (const status of REQUEST_STATUSES.filter((s) => s !== "PENDING")) {
      expect(isCancellable(status), status).toBe(false);
    }
  });

  it("pins the row to the guardian who filed it", async () => {
    answers = {
      "documentRequest.findFirst": { id: "req-1", status: "PENDING" },
    };

    await cancelRequest("req-1", "parent-1");

    // One guardian may not withdraw what another asked for, and a crafted id
    // matches nothing.
    expect(only("documentRequest", "findFirst").args).toMatchObject({
      where: { id: "req-1", requestedById: "parent-1" },
    });
    expect(only("documentRequest", "update").args).toMatchObject({
      data: { status: "CANCELLED" },
    });
  });

  it("refuses once the office has taken it on", async () => {
    answers = {
      "documentRequest.findFirst": { id: "req-1", status: "ACCEPTED" },
    };

    const result = await cancelRequest("req-1", "parent-1");

    expect(result).toEqual({ ok: false, reason: "too-late" });
    expect(of("documentRequest", "update")).toEqual([]);
  });
});

// ── Dates ────────────────────────────────────────────────────────────────────

describe("dates", () => {
  it("suggests a day the promised number of days out", () => {
    const from = new Date("2026-03-02T09:30:00");
    const suggested = suggestedReadyDate(3, from);
    expect(suggested?.toISOString().slice(0, 10)).toBe("2026-03-05");
    // Midday, so the date does not read as the day before west of here.
    expect(suggested?.getHours()).toBe(12);
  });

  it("suggests nothing when the school promises nothing", () => {
    expect(suggestedReadyDate(null)).toBeNull();
  });

  it("counts only an accepted request as late", () => {
    const past = new Date("2026-01-01");
    const now = new Date("2026-03-01");

    expect(isOverdue({ status: "ACCEPTED", readyAt: past }, now)).toBe(true);
    // Written, so nobody is waiting on the school.
    expect(isOverdue({ status: "READY", readyAt: past }, now)).toBe(false);
    expect(isOverdue({ status: "COLLECTED", readyAt: past }, now)).toBe(false);
    // Nothing was promised, so nothing is late.
    expect(isOverdue({ status: "ACCEPTED", readyAt: null }, now)).toBe(false);
  });
});
