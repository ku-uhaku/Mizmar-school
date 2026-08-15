import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/permissions";
import { getDictionaryFor } from "@/lib/i18n/server";
import {
  CHANNEL_KINDS,
  MAX_MESSAGE_LENGTH,
  generalChannelKey,
  isLive,
} from "@/modules/chat/enums";
import type { AuthContext } from "@/lib/dal";

/**
 * L'espace parents: the one place in the app where somebody with no permission
 * at all may write.
 *
 * A parent holds no code. Their right to read and post comes from the household
 * scope — the same route their child's marks take — which is why the staff half
 * and the family half are two different query files and why the phone's own
 * endpoint re-derives the channel against the household before it will take a
 * word. A channel id is guessable, and without that check one segment of a URL
 * puts a parent in another class's conversation.
 *
 * The staff half is the mirror of it: `chat.view` reads, `chat.moderate`
 * removes, and both are confined to the school in the header. There is
 * deliberately no "post" code — a school does not talk to itself here.
 *
 * ── Deleted, never gone ──────────────────────────────────────────────────────
 * Moderation is a soft delete. A school that removes a message may have to say
 * later what it removed and who removed it, to the parent who wrote it or to
 * somebody's lawyer, and a row that is actually gone cannot answer that.
 */

const t = getDictionaryFor("en");

// ─────────────────────────────────────────────────────────────────────────────

type Call = { model: string; op: string; args: unknown };

const calls: Call[] = [];
let answers: Record<string, unknown> = {};
/** Set to make the create collide, standing in for two parents at once. */
let createFails = false;

const EMPTY: Record<string, unknown> = {
  findMany: [],
  findFirst: null,
  findUnique: null,
  create: { id: "created" },
  update: {},
  updateMany: { count: 1 },
};

const db = new Proxy(
  {},
  {
    get: (_target, model: string) =>
      new Proxy(
        {},
        {
          get: (_d, op: string) => async (args: unknown) => {
            calls.push({ model, op, args });
            if (op === "create" && createFails) {
              throw new Error("unique constraint");
            }
            const key = `${model}.${op}`;
            if (key in answers) return answers[key];
            return op in EMPTY ? EMPTY[op] : null;
          },
        },
      ),
  },
);

vi.mock("@/lib/db", () => ({ db, auditClient: {} }));
vi.mock("@/lib/audit", () => ({ recordEvent: async () => {} }));

const granted = new Set<string>();
const asked: string[] = [];
let schoolInContext: string | null = "school-1";

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
    user: { id: "moderator-1" },
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

const { deleteMessage, ensureChannel, postMessage, setChannelArchived } =
  await import("@/modules/chat/service");
const { listChannels, listMessages } = await import("@/modules/chat/queries");
const { deleteMessageAction, setChannelArchivedAction } = await import(
  "@/modules/chat/actions"
);

const of = (model: string, op: string) =>
  calls.filter((call) => call.model === model && call.op === op);

const only = (model: string, op: string): Call => {
  const matches = of(model, op);
  expect(matches, `${model}.${op}`).toHaveLength(1);
  return matches[0]!;
};

/** The sentinel `lib/scope.ts` uses to mean "match nothing". */
const NO_MATCH = "__none__";

function reader(
  codes: readonly string[],
  { schoolId = "school-1" as string | null } = {},
): AuthContext {
  const held = new Set(codes);
  return {
    organization: { id: "org-1" },
    currentSchool: schoolId ? { id: schoolId } : null,
    currentSchoolYear: { id: "year-1" },
    user: { id: "moderator-1" },
    can: (code: string) => held.has(code),
    canOrg: (code: string) => held.has(code),
    canInSchool: (_school: string, code: string) => held.has(code),
  } as unknown as AuthContext;
}

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
  createFails = false;
  asked.length = 0;
  schoolInContext = "school-1";
  granted.clear();
  granted.add(PERMISSIONS.CHAT_VIEW);
  granted.add(PERMISSIONS.CHAT_MODERATE);
});

// ── The two kinds of channel ─────────────────────────────────────────────────

describe("channel kinds", () => {
  it("offers a school-wide channel and a class one, and no more", () => {
    // A school wanting "the parents of 3AP" across three classes is asking for
    // a level channel, and adding it later is a value and a nullable column,
    // not a redesign.
    expect([...CHANNEL_KINDS]).toEqual(["GENERAL", "CLASS"]);
  });

  it("keys the general channel on its year, so a year holds one", () => {
    expect(generalChannelKey("year-1", "GENERAL")).toBeTruthy();
    expect(generalChannelKey("year-1", "GENERAL")).not.toBe(
      generalChannelKey("year-2", "GENERAL"),
    );
  });

  it("exempts every class channel from that index", () => {
    // MySQL treats NULLs as distinct, which is what lets one year hold
    // twenty-four class channels and exactly one general.
    expect(generalChannelKey("year-1", "CLASS")).toBeNull();
    expect(generalChannelKey("year-1", "")).toBeNull();
    expect(generalChannelKey("year-1", "__proto__")).toBeNull();
  });

  it("reads a live message as live and a removed one as gone", () => {
    expect(isLive({ deletedAt: null })).toBe(true);
    expect(isLive({ deletedAt: new Date() })).toBe(false);
  });
});

// ── Channels come into being when somebody looks ─────────────────────────────

describe("ensureChannel", () => {
  const input = (extra: Record<string, unknown> = {}) =>
    ({
      schoolId: "school-1",
      schoolYearId: "year-1",
      kind: "CLASS",
      schoolClassId: "class-1",
      ...extra,
    }) as Parameters<typeof ensureChannel>[0];

  it("hands back the channel that already exists", async () => {
    answers = { "chatChannel.findFirst": { id: "chan-1", isArchived: false } };
    expect(await ensureChannel(input())).toEqual({
      id: "chan-1",
      isArchived: false,
    });
    expect(of("chatChannel", "create")).toEqual([]);
  });

  it("creates one the first time anybody opens it", async () => {
    // A school with 24 classes does not want 25 empty channels the moment
    // somebody flicks a switch, and a class created in November would miss a
    // provisioning pass anyway.
    const result = await ensureChannel(input());
    expect(result).toEqual({ id: "created" });
    expect(only("chatChannel", "create").args).toMatchObject({
      data: { schoolId: "school-1", kind: "CLASS", schoolClassId: "class-1" },
    });
  });

  it("refuses a class channel with no class", async () => {
    // The invariant MySQL cannot express. Null rather than a stack trace: the
    // kind and the class come from a request, so this is a crafted call.
    expect(await ensureChannel(input({ schoolClassId: null }))).toBeNull();
    expect(calls).toEqual([]);
  });

  it("refuses a general channel that names a class", async () => {
    expect(
      await ensureChannel(input({ kind: "GENERAL", schoolClassId: "class-1" })),
    ).toBeNull();
    expect(calls).toEqual([]);
  });

  it("creates a general channel with the year's key on it", async () => {
    await ensureChannel(input({ kind: "GENERAL", schoolClassId: null }));
    const data = (only("chatChannel", "create").args as {
      data: Record<string, unknown>;
    }).data;
    expect(data["generalKey"]).toBeTruthy();
    expect(data["schoolClassId"]).toBeNull();
  });

  it("leaves the key off a class channel", async () => {
    await ensureChannel(input());
    const data = (only("chatChannel", "create").args as {
      data: Record<string, unknown>;
    }).data;
    expect(data["generalKey"]).toBeNull();
  });

  it("hands back the winner when two parents open it at once", async () => {
    // The second loses on the unique index, and the right answer is the row the
    // first one made rather than an error nobody can act on.
    createFails = true;
    answers = {};
    let seen = 0;
    answers = {
      get "chatChannel.findFirst"() {
        seen += 1;
        return seen === 1 ? null : { id: "chan-winner", isArchived: false };
      },
    } as unknown as Record<string, unknown>;

    expect(await ensureChannel(input())).toEqual({
      id: "chan-winner",
      isArchived: false,
    });
  });

  it("answers null when the re-read finds nothing either", async () => {
    // Re-read rather than assume, so a genuine failure still surfaces.
    createFails = true;
    expect(await ensureChannel(input())).toBeNull();
  });
});

// ── Posting ──────────────────────────────────────────────────────────────────

describe("postMessage", () => {
  const open = (extra: Record<string, unknown> = {}) => {
    answers = {
      "chatChannel.findFirst": { id: "chan-1", isArchived: false, ...extra },
    };
  };

  it("writes a message into the channel", async () => {
    open();
    const result = await postMessage("chan-1", "parent-1", "Bonjour");

    expect(result).toEqual({ ok: true, id: "created" });
    expect(only("chatMessage", "create").args).toMatchObject({
      data: { channelId: "chan-1", authorId: "parent-1", body: "Bonjour" },
    });
  });

  it("trims what it stores", async () => {
    open();
    await postMessage("chan-1", "parent-1", "  Bonjour  ");
    const data = (only("chatMessage", "create").args as {
      data: Record<string, unknown>;
    }).data;
    expect(data["body"]).toBe("Bonjour");
  });

  it("refuses a message with nothing in it", async () => {
    open();
    for (const body of ["", "   ", "\n\t"]) {
      calls.length = 0;
      open();
      expect(await postMessage("chan-1", "parent-1", body), body).toEqual({
        ok: false,
        reason: "EMPTY",
      });
      expect(of("chatMessage", "create"), body).toEqual([]);
    }
  });

  it("refuses one longer than a parent may post", async () => {
    open();
    expect(
      await postMessage("chan-1", "parent-1", "x".repeat(MAX_MESSAGE_LENGTH + 1)),
    ).toEqual({ ok: false, reason: "TOO_LONG" });
    expect(of("chatMessage", "create")).toEqual([]);
  });

  it("accepts one exactly at the limit", async () => {
    open();
    expect(
      await postMessage("chan-1", "parent-1", "x".repeat(MAX_MESSAGE_LENGTH)),
    ).toMatchObject({ ok: true });
  });

  it("measures the length after trimming", async () => {
    // A message padded to the limit with spaces is not too long.
    open();
    expect(
      await postMessage(
        "chan-1",
        "parent-1",
        `  ${"x".repeat(MAX_MESSAGE_LENGTH)}  `,
      ),
    ).toMatchObject({ ok: true });
  });

  it("refuses a channel that does not exist", async () => {
    expect(await postMessage("nowhere", "parent-1", "Bonjour")).toEqual({
      ok: false,
      reason: "NOT_FOUND",
    });
    expect(of("chatMessage", "create")).toEqual([]);
  });

  it("refuses a channel that has been closed", async () => {
    // A closed channel stays readable and refuses new messages — the whole
    // difference between closing one and deleting it.
    open({ isArchived: true });
    expect(await postMessage("chan-1", "parent-1", "Bonjour")).toEqual({
      ok: false,
      reason: "ARCHIVED",
    });
    expect(of("chatMessage", "create")).toEqual([]);
  });

  it("checks the message before it goes near the database", async () => {
    // An empty body is answerable without a query.
    await postMessage("chan-1", "parent-1", "");
    expect(calls).toEqual([]);
  });
});

// ── Moderation ───────────────────────────────────────────────────────────────

describe("deleteMessage", () => {
  it("stamps rather than removes", async () => {
    // The school may have to say later what it removed and who removed it.
    expect(await deleteMessage("msg-1", "school-1", "moderator-1")).toBe(true);

    const call = only("chatMessage", "updateMany").args as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(call.data["deletedById"]).toBe("moderator-1");
    expect(call.data["deletedAt"]).toBeInstanceOf(Date);
    expect(call.data).not.toHaveProperty("body");
  });

  it("reaches only its own school's conversation", async () => {
    // A message id from a request must not reach another school's.
    await deleteMessage("msg-1", "school-1", "moderator-1");
    expect(only("chatMessage", "updateMany").args).toMatchObject({
      where: { id: "msg-1", channel: { schoolId: "school-1" } },
    });
  });

  it("does not overwrite the first moderator's name", async () => {
    // A second moderator pressing the same button must not take the credit —
    // or the blame — for a removal somebody else made.
    await deleteMessage("msg-1", "school-1", "moderator-2");
    expect(only("chatMessage", "updateMany").args).toMatchObject({
      where: { deletedAt: null },
    });
  });

  it("reports nothing removed when it matched nothing", async () => {
    answers = { "chatMessage.updateMany": { count: 0 } };
    expect(await deleteMessage("msg-1", "school-1", "moderator-1")).toBe(false);
  });
});

describe("setChannelArchived", () => {
  it("closes a channel of its own school", async () => {
    expect(await setChannelArchived("chan-1", "school-1", true)).toBe(true);
    expect(only("chatChannel", "updateMany").args).toMatchObject({
      where: { id: "chan-1", schoolId: "school-1" },
      data: { isArchived: true },
    });
  });

  it("reopens one", async () => {
    await setChannelArchived("chan-1", "school-1", false);
    expect(only("chatChannel", "updateMany").args).toMatchObject({
      data: { isArchived: false },
    });
  });

  it("reports nothing changed for a channel of another school", async () => {
    answers = { "chatChannel.updateMany": { count: 0 } };
    expect(await setChannelArchived("chan-1", "school-1", true)).toBe(false);
  });
});

// ── The staff reads ──────────────────────────────────────────────────────────

describe("listChannels", () => {
  it("reads this school's channels for this year", async () => {
    await listChannels(reader([PERMISSIONS.CHAT_VIEW]));
    const values = stringsIn(only("chatChannel", "findMany").args);
    expect(values).toContain("school-1");
    expect(values).toContain("year-1");
  });

  it("matches nothing with no school in context", async () => {
    await listChannels(reader([PERMISSIONS.CHAT_VIEW], { schoolId: null }));
    expect(stringsIn(only("chatChannel", "findMany").args)).toContain(NO_MATCH);
  });

  it("counts only the messages still standing", async () => {
    // A moderator's channel list should not advertise a conversation that is
    // entirely removed messages.
    await listChannels(reader([PERMISSIONS.CHAT_VIEW]));
    expect(JSON.stringify(only("chatChannel", "findMany").args)).toContain(
      "deletedAt",
    );
  });
});

describe("listMessages", () => {
  it("re-derives the channel against the school before reading it", async () => {
    answers = { "chatChannel.findFirst": { id: "chan-1" } };
    await listMessages(reader([PERMISSIONS.CHAT_VIEW]), "chan-1");

    expect(only("chatChannel", "findFirst").args).toMatchObject({
      where: { id: "chan-1", schoolId: "school-1" },
    });
  });

  it("answers nothing for a channel of another school", async () => {
    expect(
      await listMessages(reader([PERMISSIONS.CHAT_VIEW]), "chan-elsewhere"),
    ).toBeNull();
    expect(of("chatMessage", "findMany")).toEqual([]);
  });

  it("shows a moderator what was removed", async () => {
    // Otherwise "was this dealt with?" is a question the screen cannot answer,
    // and the same message gets reported twice.
    answers = { "chatChannel.findFirst": { id: "chan-1" } };
    await listMessages(reader([PERMISSIONS.CHAT_VIEW]), "chan-1");

    const where = (only("chatMessage", "findMany").args as {
      where: Record<string, unknown>;
    }).where;
    expect(where).not.toHaveProperty("deletedAt");
  });

  it("bounds what one read returns", async () => {
    answers = { "chatChannel.findFirst": { id: "chan-1" } };
    await listMessages(reader([PERMISSIONS.CHAT_VIEW]), "chan-1");
    expect(only("chatMessage", "findMany").args).toHaveProperty("take");
  });
});

// ── The staff actions ────────────────────────────────────────────────────────

describe("deleteMessageAction", () => {
  it("asks for chat.moderate before touching anything", async () => {
    granted.clear();
    const state = await deleteMessageAction("msg-1");

    expect(asked).toEqual([PERMISSIONS.CHAT_MODERATE]);
    expect(state.status).toBe("error");
    expect(of("chatMessage", "updateMany")).toEqual([]);
  });

  it("is not opened by chat.view alone", async () => {
    // Reading a conversation is not the same as being able to take something
    // out of it.
    granted.clear();
    granted.add(PERMISSIONS.CHAT_VIEW);
    const state = await deleteMessageAction("msg-1");

    expect(state.status).toBe("error");
    expect(of("chatMessage", "updateMany")).toEqual([]);
  });

  it("removes a message for a moderator", async () => {
    const state = await deleteMessageAction("msg-1");
    expect(state.status).toBe("success");
  });

  it("stamps the moderator from the session, never the request", async () => {
    await deleteMessageAction("msg-1");
    const data = (only("chatMessage", "updateMany").args as {
      data: Record<string, unknown>;
    }).data;
    expect(data["deletedById"]).toBe("moderator-1");
  });

  it("refuses with no school in context", async () => {
    schoolInContext = null;
    const state = await deleteMessageAction("msg-1");

    expect(state.status).toBe("error");
    expect(asked).toEqual([]);
    expect(of("chatMessage", "updateMany")).toEqual([]);
  });

  it("reports not-found when nothing matched", async () => {
    answers = { "chatMessage.updateMany": { count: 0 } };
    const state = await deleteMessageAction("msg-1");
    expect(state.status).toBe("error");
    expect(state.message).toBe(t.errors.notFound);
  });
});

describe("setChannelArchivedAction", () => {
  it("asks for chat.moderate", async () => {
    granted.clear();
    granted.add(PERMISSIONS.CHAT_VIEW);
    const state = await setChannelArchivedAction("chan-1", true);

    expect(state.status).toBe("error");
    expect(of("chatChannel", "updateMany")).toEqual([]);
  });

  it("closes a channel and says so", async () => {
    const state = await setChannelArchivedAction("chan-1", true);
    expect(state.status).toBe("success");
    expect(only("chatChannel", "updateMany").args).toMatchObject({
      where: { schoolId: "school-1" },
      data: { isArchived: true },
    });
  });

  it("takes the school from the header, never from the request", async () => {
    await setChannelArchivedAction("chan-1", true);
    const where = (only("chatChannel", "updateMany").args as {
      where: Record<string, unknown>;
    }).where;
    expect(where["schoolId"]).toBe("school-1");
  });

  it("refuses with no school in context", async () => {
    schoolInContext = null;
    const state = await setChannelArchivedAction("chan-1", true);
    expect(state.status).toBe("error");
    expect(of("chatChannel", "updateMany")).toEqual([]);
  });
});
