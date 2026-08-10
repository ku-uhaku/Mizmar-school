import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  USERNAME_MAX_LENGTH,
  isValidUsername,
  looksLikeEmail,
  normalizeUsername,
  suggestUsername,
  uniqueUsername,
} from "@/modules/users/enums";

/**
 * What staff sign in with.
 *
 * The login identifier is the one string in the app that decides *whose*
 * account a request is acting as, so what is tested here is the handful of
 * rules that keep it unambiguous —
 *
 *   * **one spelling reaches the column.** `K.Bennis` and `k.bennis` are the
 *     same login, and storing both would make the unique index a lie;
 *   * **a name reduces to something a person can dictate over the phone**, with
 *     accents folded rather than dropped;
 *   * **two people of the same name both get an account**, which in a school of
 *     two hundred is a Tuesday;
 *   * **an `@` decides which column is looked in**, so a username can never
 *     shadow somebody else's email address at the login box;
 *   * **an account with no username still signs in by email**, which is what
 *     makes the rollout safe on a school whose accounts predate the column.
 */

// ── The shape ────────────────────────────────────────────────────────────────

describe("what a username may be", () => {
  it("accepts the ordinary shapes", () => {
    for (const value of ["k.bennis", "kbennis", "k_bennis", "k-bennis", "a1b"]) {
      expect(isValidUsername(value), value).toBe(true);
    }
  });

  it("refuses what would not survive a login box", () => {
    for (const value of [
      "", // nothing
      "ab", // too short to be anybody's
      "k bennis", // a space nobody would type twice the same way
      "k@bennis", // an @ would send it down the email path
      ".bennis", // leads with punctuation
      "-bennis",
      "_bennis",
      "kbénnis", // an accent the keyboard may not have
      "k/bennis",
      "a".repeat(USERNAME_MAX_LENGTH + 1),
    ]) {
      expect(isValidUsername(value), JSON.stringify(value)).toBe(false);
    }
  });

  it("treats capitals as the same login", () => {
    // Otherwise a teacher typing their own name with a capital is refused, and
    // the unique index would happily store both spellings as two people.
    expect(normalizeUsername("  K.Bennis  ")).toBe("k.bennis");
    expect(isValidUsername("K.BENNIS")).toBe(true);
  });
});

// ── Building one from a name ─────────────────────────────────────────────────

describe("the suggestion", () => {
  it("is the initial and the surname", () => {
    expect(suggestUsername("Karim", "Bennis")).toBe("k.bennis");
  });

  it("folds accents rather than dropping the letters", () => {
    // `benssa` would be unguessable and undictatable; `benissa` is the name.
    expect(suggestUsername("Zineb", "Benîssa")).toBe("z.benissa");
    expect(suggestUsername("Aïcha", "El-Fassi")).toBe("a.elfassi");
  });

  it("gives up rather than inventing something meaningless", () => {
    // Arabic script has no ASCII fold. The form asks for one instead of
    // proposing an account nobody could sign into.
    expect(suggestUsername("كريم", "بنيس")).toBe("");
    expect(suggestUsername("", "")).toBe("");
    // A single letter each still makes three characters with the dot, which is
    // the minimum and therefore allowed — `a.b` is a poor username but a real
    // one, and refusing it would leave the form with nothing to offer.
    expect(suggestUsername("A", "B")).toBe("a.b");
    expect(isValidUsername("a.b")).toBe(true);
    // One letter and no surname does not reach the minimum.
    expect(suggestUsername("A", "")).toBe("");
  });

  it("copes with only one name", () => {
    expect(suggestUsername("", "Bennis")).toBe("bennis");
    expect(suggestUsername("Bennis", "")).toBe("bennis");
  });

  it("never proposes something the validator would refuse", () => {
    for (const [first, last] of [
      ["Karim", "Bennis"],
      ["Zineb", "Benîssa"],
      ["Aïcha", "El-Fassi"],
      ["Jean-Pierre", "de la Croix"],
      ["Mohammed", "A".repeat(60)],
    ]) {
      const suggestion = suggestUsername(first, last);
      if (suggestion !== "") {
        expect(isValidUsername(suggestion), `${first} ${last}`).toBe(true);
      }
    }
  });
});

describe("two people of the same name", () => {
  it("hands the second one a free username", () => {
    expect(uniqueUsername("k.bennis", new Set())).toBe("k.bennis");
    expect(uniqueUsername("k.bennis", new Set(["k.bennis"]))).toBe("k.bennis2");
    expect(uniqueUsername("k.bennis", new Set(["k.bennis", "k.bennis2"]))).toBe(
      "k.bennis3",
    );
  });

  it("trims the suffix into the length limit rather than past it", () => {
    // A long surname must still yield something the column accepts.
    const base = "a".repeat(USERNAME_MAX_LENGTH);
    const next = uniqueUsername(base, new Set([base]));

    expect(next.length).toBeLessThanOrEqual(USERNAME_MAX_LENGTH);
    expect(isValidUsername(next)).toBe(true);
    expect(next).not.toBe(base);
  });

  it("normalises before it compares", () => {
    expect(uniqueUsername("K.Bennis", new Set(["k.bennis"]))).toBe("k.bennis2");
  });

  it("has nothing to offer when there is no base", () => {
    expect(uniqueUsername("", new Set())).toBe("");
  });
});

// ── Which column a login looks in ────────────────────────────────────────────

describe("telling a username from an email", () => {
  it("decides on the @", () => {
    expect(looksLikeEmail("karim.bennis@almanar.ma")).toBe(true);
    expect(looksLikeEmail("k.bennis")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

type Call = { model: string; op: string; args: Record<string, unknown> };
const calls: Call[] = [];
let answers: Record<string, unknown> = {};

const db = new Proxy(
  {},
  {
    get: (_t, model: string) =>
      new Proxy(
        {},
        {
          get: (_d, op: string) => async (args: Record<string, unknown>) => {
            calls.push({ model, op, args });
            const key = `${model}.${op}`;
            return key in answers ? answers[key] : null;
          },
        },
      ),
  },
);

vi.mock("@/lib/db", () => ({ db, auditClient: {} }));
vi.mock("@/lib/audit", () => ({ recordEvent: async () => {} }));
vi.mock("@/lib/login-throttle", () => ({
  checkLoginThrottle: async () => ({ locked: false, retryAfterSeconds: 0 }),
  clearLoginAttempts: async () => {},
  recordFailedLogin: async () => {},
}));

const { checkCredentials } = await import("@/lib/auth");

beforeEach(() => {
  calls.length = 0;
  answers = {};
});

describe("resolving a login", () => {
  const lookup = () =>
    calls.find((call) => call.model === "user" && call.op === "findUnique");

  it("looks a username up in the username column", async () => {
    await checkCredentials("k.bennis", "secret");
    expect(lookup()?.args).toMatchObject({ where: { username: "k.bennis" } });
  });

  it("looks an address up in the email column", async () => {
    // The phone still sends one, and a guardian has no username at all.
    await checkCredentials("parent@famille.ma", "secret");
    expect(lookup()?.args).toMatchObject({
      where: { email: "parent@famille.ma" },
    });
  });

  it("never tries the other column as a fallback", async () => {
    /*
      Two lookups would leak, twice over: the timing difference would tell a
      caller whether a username exists, and somebody could register a username
      equal to another account's email local part and shadow them at the login
      box. One identifier, one column.
    */
    await checkCredentials("k.bennis", "secret");
    expect(
      calls.filter((call) => call.model === "user" && call.op === "findUnique"),
    ).toHaveLength(1);
  });

  it("lowercases whichever column it uses", async () => {
    await checkCredentials("  K.Bennis  ", "secret");
    expect(lookup()?.args).toMatchObject({ where: { username: "k.bennis" } });

    calls.length = 0;
    await checkCredentials("Parent@Famille.MA", "secret");
    expect(lookup()?.args).toMatchObject({
      where: { email: "parent@famille.ma" },
    });
  });

  it("answers the same way for an unknown username as a wrong password", async () => {
    // Telling the two apart is telling a stranger which accounts exist.
    answers = {};
    const unknown = await checkCredentials("nobody.here", "secret");
    expect(unknown).toEqual({ ok: false, reason: "invalid" });
  });
});
