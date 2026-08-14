import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  REVIEW_TRANSITIONS,
  SUPPLY_CATEGORIES,
  SUPPLY_STATUSES,
  allowedReviewTransitions,
  canReviewTo,
  dueOnValue,
  isEditableByAuthor,
  isPassed,
  isVisibleToFamilies,
  stillDueWhere,
} from "@/modules/supplies/enums";

/**
 * La liste de fournitures: what a class is asked to buy, and who decided it.
 *
 * The module is a two-person workflow and the permissions say so — `supply.write`
 * is the teacher's half, `supply.review` the office's — because the whole point
 * is that a teacher says what the class needs and somebody answerable for the
 * school decides whether parents will be asked to pay for it.
 *
 * Everything below turns on that split holding in three places at once:
 *
 *   * **only an approved list reaches a family.** A draft is somebody thinking
 *     aloud and a refusal is an internal note.
 *   * **an approved list is closed to its author.** Families may already have
 *     bought against it, so changing it is a new decision and a new review.
 *   * **the transitions are a table, not scattered `if`s** — so a screen never
 *     offers a move the service refuses, which is worse than offering none.
 */

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
            return op === "findFirst" || op === "findUnique" ? null : {};
          },
        },
      ),
  },
);

vi.mock("@/lib/db", () => ({ db, auditClient: {} }));

const { reviewList, submitList } = await import("@/modules/supplies/service");

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
});

// ── What a family may see ────────────────────────────────────────────────────

describe("visibility", () => {
  it("shows a family an approved list and nothing else", () => {
    // A draft is somebody thinking aloud, a submission is a question, and a
    // refusal is an internal note.
    expect(SUPPLY_STATUSES.filter(isVisibleToFamilies)).toEqual(["APPROVED"]);
  });

  it("says no to a status it has never heard of", () => {
    for (const nonsense of ["", "approved", "PUBLISHED", "__proto__"]) {
      expect(isVisibleToFamilies(nonsense), nonsense).toBe(false);
    }
  });

  it("keeps a refusal rather than deleting it", () => {
    // A list that simply vanished would be rewritten identically the following
    // week, and the reason it was refused is the only thing that stops that.
    expect(SUPPLY_STATUSES).toContain("REJECTED");
  });
});

// ── Whose list it is to edit ─────────────────────────────────────────────────

describe("isEditableByAuthor", () => {
  it("lets the author work on a draft and act on a refusal", () => {
    // Acting on the reason is the whole point of sending it back.
    expect(SUPPLY_STATUSES.filter(isEditableByAuthor)).toEqual([
      "DRAFT",
      "REJECTED",
    ]);
  });

  it("closes an approved list to its author", () => {
    // It has been agreed and families may already have bought against it, so
    // changing it is a new decision and a new review.
    expect(isEditableByAuthor("APPROVED")).toBe(false);
  });

  it("closes one that is waiting on a decision", () => {
    // Editing under the reviewer's hands would change what they are deciding.
    expect(isEditableByAuthor("SUBMITTED")).toBe(false);
  });
});

// ── The transition table ─────────────────────────────────────────────────────

describe("the office's moves", () => {
  it("offers a decision on what it was asked to decide", () => {
    expect([...allowedReviewTransitions("SUBMITTED")]).toEqual([
      "APPROVED",
      "REJECTED",
    ]);
  });

  it("lets an approved list be withdrawn back to the office's own queue", () => {
    // A price rise, a change of mind — and it goes to SUBMITTED rather than
    // back to the teacher, because withdrawing is the office's call and not a
    // rejection.
    expect([...allowedReviewTransitions("APPROVED")]).toEqual(["SUBMITTED"]);
  });

  it("gives the office nothing to do with a draft", () => {
    // It has not been handed to them yet.
    expect(allowedReviewTransitions("DRAFT")).toEqual([]);
  });

  it("lets a refusal be approved after all", () => {
    expect([...allowedReviewTransitions("REJECTED")]).toEqual(["APPROVED"]);
  });

  it("answers no moves for a state it has never heard of, rather than throwing", () => {
    // `REVIEW_TRANSITIONS` is a plain object, so a bare lookup of "constructor"
    // answered a function and calling `.includes` on it threw.
    for (const from of ["", "__proto__", "constructor", "toString", "draft"]) {
      expect(allowedReviewTransitions(from), from).toEqual([]);
      expect(canReviewTo(from, "APPROVED"), from).toBe(false);
    }
    expect(canReviewTo("SUBMITTED", "__proto__")).toBe(false);
  });

  it("never lets a list move to where it already is", () => {
    for (const status of SUPPLY_STATUSES) {
      expect(canReviewTo(status, status), status).toBe(false);
    }
  });

  it("offers only statuses the column may hold", () => {
    for (const from of SUPPLY_STATUSES) {
      for (const next of allowedReviewTransitions(from)) {
        expect(SUPPLY_STATUSES, `${from}→${next}`).toContain(next);
      }
    }
  });

  it("covers every declared status", () => {
    // A status missing from the table is one the office silently cannot act on.
    expect(Object.keys(REVIEW_TRANSITIONS).sort()).toEqual(
      [...SUPPLY_STATUSES].sort(),
    );
  });

  it("is the one place both the service and the dialog read", () => {
    // The table exists so a screen never offers a move the service refuses.
    for (const from of SUPPLY_STATUSES) {
      for (const next of SUPPLY_STATUSES) {
        expect(canReviewTo(from, next), `${from}→${next}`).toBe(
          allowedReviewTransitions(from).includes(next),
        );
      }
    }
  });
});

// ── Reviewing ────────────────────────────────────────────────────────────────

describe("reviewList", () => {
  const listIn = (status: string) => {
    answers = { "supplyList.findFirst": { id: "list-1", status } };
  };

  it("approves a submitted list and stamps who said so", async () => {
    // `reviewedAt` and `reviewedById` are the answer to "who said we could ask
    // parents for this" — never taken from the form.
    listIn("SUBMITTED");
    expect(
      await reviewList("list-1", "school-1", "APPROVED", null, "head-1"),
    ).toEqual({ ok: true });

    const data = (only("supplyList", "update").args as {
      data: Record<string, unknown>;
    }).data;
    expect(data["status"]).toBe("APPROVED");
    expect(data["reviewedById"]).toBe("head-1");
    expect(data["reviewedAt"]).toBeInstanceOf(Date);
  });

  it("refuses a move the table does not allow", async () => {
    listIn("DRAFT");
    expect(
      await reviewList("list-1", "school-1", "APPROVED", null, "head-1"),
    ).toEqual({ ok: false, reason: "bad-transition" });
    expect(of("supplyList", "update")).toEqual([]);
  });

  it("refuses a status nothing recognises", async () => {
    listIn("SUBMITTED");
    for (const status of ["", "PUBLISHED", "approved", "__proto__"]) {
      calls.length = 0;
      listIn("SUBMITTED");
      expect(
        await reviewList("list-1", "school-1", status, null, "head-1"),
        status,
      ).toEqual({ ok: false, reason: "bad-transition" });
      expect(of("supplyList", "update"), status).toEqual([]);
    }
  });

  it("keeps a refusal's reason and drops it on the next decision", async () => {
    // A later approval must not leave a stale refusal note attached — the
    // reason belongs to the decision that carried it.
    listIn("SUBMITTED");
    await reviewList("list-1", "school-1", "REJECTED", "Trop cher.", "head-1");
    expect(
      (only("supplyList", "update").args as { data: { reviewNote: unknown } })
        .data.reviewNote,
    ).toBe("Trop cher.");

    calls.length = 0;
    listIn("REJECTED");
    await reviewList("list-1", "school-1", "APPROVED", "ignored", "head-1");
    expect(
      (only("supplyList", "update").args as { data: { reviewNote: unknown } })
        .data.reviewNote,
    ).toBeNull();
  });

  it("scopes the list by school, never by id alone", async () => {
    listIn("SUBMITTED");
    await reviewList("list-1", "school-1", "APPROVED", null, "head-1");
    expect(only("supplyList", "findFirst").args).toMatchObject({
      where: { id: "list-1", schoolId: "school-1" },
    });
  });

  it("refuses a list of another school", async () => {
    expect(
      await reviewList("list-1", "school-1", "APPROVED", null, "head-1"),
    ).toEqual({ ok: false, reason: "not-found" });
    expect(of("supplyList", "update")).toEqual([]);
  });
});

// ── Submitting ───────────────────────────────────────────────────────────────

describe("submitList", () => {
  const mine = (status: string) => {
    answers = { "supplyList.findFirst": { id: "list-1", status } };
  };

  it("hands a draft to the office", async () => {
    mine("DRAFT");
    expect(await submitList("list-1", "school-1", "teacher-1")).toEqual({
      ok: true,
    });
    expect(only("supplyList", "update").args).toMatchObject({
      data: { status: "SUBMITTED", reviewNote: null },
    });
  });

  it("hands back a refused list once the reason has been acted on", async () => {
    mine("REJECTED");
    expect(await submitList("list-1", "school-1", "teacher-1")).toEqual({
      ok: true,
    });
  });

  it("clears the old refusal note on the way", async () => {
    // The office is being asked afresh, not shown its own last answer.
    mine("REJECTED");
    await submitList("list-1", "school-1", "teacher-1");
    expect(
      (only("supplyList", "update").args as { data: { reviewNote: unknown } })
        .data.reviewNote,
    ).toBeNull();
  });

  it("refuses to resubmit a list already decided", async () => {
    // That is a withdrawal, and a withdrawal is the office's call.
    for (const status of ["SUBMITTED", "APPROVED"]) {
      calls.length = 0;
      mine(status);
      expect(
        await submitList("list-1", "school-1", "teacher-1"),
        status,
      ).toEqual({ ok: false, reason: "bad-transition" });
      expect(of("supplyList", "update"), status).toEqual([]);
    }
  });

  it("scopes the list by its author as well as the school", async () => {
    // Submitting somebody else's draft would put their name on a decision they
    // did not ask for.
    mine("DRAFT");
    await submitList("list-1", "school-1", "teacher-1");
    expect(only("supplyList", "findFirst").args).toMatchObject({
      where: { id: "list-1", schoolId: "school-1", authorId: "teacher-1" },
    });
  });

  it("refuses a list that is not the caller's", async () => {
    expect(await submitList("list-1", "school-1", "teacher-2")).toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(of("supplyList", "update")).toEqual([]);
  });

  it("never stamps a reviewer on the author's own move", async () => {
    // Submitting is not a decision; the office has not seen it yet.
    mine("DRAFT");
    await submitList("list-1", "school-1", "teacher-1");
    const data = (only("supplyList", "update").args as {
      data: Record<string, unknown>;
    }).data;

    expect(data).not.toHaveProperty("reviewedById");
    expect(data).not.toHaveProperty("reviewedAt");
  });
});

// ── The catalogue ────────────────────────────────────────────────────────────

describe("the article categories", () => {
  it("names the shelves of a papeterie, not an inventory taxonomy", () => {
    // Broad on purpose: a category nobody can place an article in is a category
    // that gets used wrongly.
    expect(SUPPLY_CATEGORIES).toContain("ECRITURE");
    expect(SUPPLY_CATEGORIES).toContain("CAHIERS");
    expect(SUPPLY_CATEGORIES).toContain("GEOMETRIE");
  });

  it("keeps a catch-all last, for what the shelves do not cover", () => {
    expect(SUPPLY_CATEGORIES.at(-1)).toBe("AUTRE");
  });

  it("names each one once", () => {
    expect(new Set(SUPPLY_CATEGORIES).size).toBe(SUPPLY_CATEGORIES.length);
  });

  it("stays small enough for a picker to group by", () => {
    // The only reason a catalogue of eighty articles is usable.
    expect(SUPPLY_CATEGORIES.length).toBeLessThanOrEqual(12);
  });
});

// ── The deadline, and what it retires ────────────────────────────────────────

describe("a list's deadline", () => {
  const day = (iso: string) => new Date(`${iso}T00:00:00`);

  it("stores the end of the day the school named", () => {
    // A list due "le 15 septembre" is due all of the 15th. Stored at midnight
    // it would retire itself on the morning it matters most.
    const due = dueOnValue(day("2026-09-15"));
    expect(due?.getHours()).toBe(23);
    expect(due?.getMinutes()).toBe(59);
    expect(due?.getDate()).toBe(15);
  });

  it("leaves a list with no deadline alone", () => {
    expect(dueOnValue(null)).toBeNull();
  });

  it("is still due on the morning it is due", () => {
    const due = dueOnValue(day("2026-09-15")) as Date;
    expect(isPassed(due, new Date("2026-09-15T07:30:00"))).toBe(false);
    expect(isPassed(due, new Date("2026-09-15T22:00:00"))).toBe(false);
  });

  it("has passed the day after", () => {
    const due = dueOnValue(day("2026-09-15")) as Date;
    expect(isPassed(due, new Date("2026-09-16T00:05:00"))).toBe(true);
  });

  it("never passes without a deadline", () => {
    // The general rentrée list simply stands, and stands until the year does.
    expect(isPassed(null, new Date("2099-01-01"))).toBe(false);
  });

  it("keeps the undated lists in the families' clause", () => {
    // A `where` fragment, not a predicate: filtering after the read would hand
    // a parent a screen of lists they can no longer act on.
    const now = new Date("2026-09-16T09:00:00");
    expect(stillDueWhere(now)).toEqual({
      OR: [{ dueOn: null }, { dueOn: { gte: now } }],
    });
  });
});
