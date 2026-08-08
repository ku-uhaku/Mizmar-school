import { beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_MESSAGE_LENGTH } from "@/modules/chat/enums";

/**
 * `POST /api/mobile/v1/family/channels/{id}/messages` — the one endpoint in the
 * app a person with no permission may write through.
 *
 * Two things have to hold, and they are different in kind:
 *
 *   * **the channel is re-derived against the household**, never trusted from
 *     the path. A channel id is guessable, and without that check one segment
 *     of a URL puts a parent in another class's conversation. A channel that is
 *     not theirs answers the same 404 as one that does not exist, because
 *     telling the two apart confirms it exists.
 *   * **a bad request is answered as one.** An empty or over-long body used to
 *     reach `postMessage`, come back refused, and be rethrown as a server
 *     error — so `POST {}` from anything but the first-party app got a 500 and
 *     a line in the log.
 */

// ─────────────────────────────────────────────────────────────────────────────

type Reply = { kind: "error"; code: string; status: number } | { kind: "ok"; data: unknown };

let reply: Reply | null = null;

/** What the household read answers, and what it was asked. */
let canPost = true;
const postAsked: string[] = [];

vi.mock("@/lib/mobile-api", () => ({
  apiError: (code: string, _message: string, status: number) => {
    reply = { kind: "error", code, status };
    return reply;
  },
  preflight: () => null,
  withAuth: async (handler: (context: unknown) => Promise<unknown>) => {
    try {
      const data = await handler({ user: { id: "parent-1" } });
      reply =
        data === null
          ? { kind: "error", code: "not_found", status: 404 }
          : { kind: "ok", data };
    } catch {
      // What `withAuth` does with a genuine bug: log it and answer 500.
      reply = { kind: "error", code: "server_error", status: 500 };
    }
    return reply;
  },
}));

const posted: { channelId: string; authorId: string; body: string }[] = [];
let postOutcome: { ok: boolean; reason?: string } = { ok: true };

vi.mock("@/modules/chat/service", () => ({
  postMessage: async (channelId: string, authorId: string, body: string) => {
    posted.push({ channelId, authorId, body });
    return postOutcome.ok
      ? { ok: true, id: "msg-1" }
      : { ok: false, reason: postOutcome.reason };
  },
}));

vi.mock("@/modules/portal/queries", () => ({
  canPostToChannel: async (userId: string, channelId: string) => {
    postAsked.push(`${userId}:${channelId}`);
    return canPost;
  },
  loadChannelMessages: async () => null,
}));

const { POST } = await import(
  "@/app/api/mobile/v1/family/channels/[channelId]/messages/route"
);

/** One call, with a JSON body. */
function send(body: unknown, channelId = "chan-1") {
  return POST(
    new Request("https://school.test/api", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ channelId }) },
  ) as unknown as Promise<Reply>;
}

beforeEach(() => {
  reply = null;
  posted.length = 0;
  postAsked.length = 0;
  canPost = true;
  postOutcome = { ok: true };
});

// ── A bad request is a bad request ───────────────────────────────────────────

describe("what the endpoint refuses before it does anything", () => {
  it("answers 400 for a body with nothing in it", async () => {
    // The regression. This used to reach `postMessage`, come back EMPTY, and be
    // rethrown — which `withAuth` logs and answers 500. `POST {}` is plainly a
    // bad request, and the rest of the app returns expected failures rather
    // than throwing them.
    for (const body of [{}, { body: "" }, { body: "   " }, { body: 42 }]) {
      reply = null;
      posted.length = 0;

      const answer = await send(body);
      expect(answer.kind, JSON.stringify(body)).toBe("error");
      expect((answer as { status: number }).status).toBe(400);
      expect(posted).toEqual([]);
    }
  });

  it("answers 400 for a message longer than a parent may post", async () => {
    const answer = await send({ body: "x".repeat(MAX_MESSAGE_LENGTH + 1) });

    expect((answer as { status: number }).status).toBe(400);
    expect(posted).toEqual([]);
  });

  it("accepts one exactly at the limit", async () => {
    const answer = await send({ body: "x".repeat(MAX_MESSAGE_LENGTH) });
    expect(answer.kind).toBe("ok");
  });

  it("measures after trimming, so padding is not length", async () => {
    const answer = await send({
      body: `  ${"x".repeat(MAX_MESSAGE_LENGTH)}  `,
    });
    expect(answer.kind).toBe("ok");
  });

  it("answers 400 for a body that is not JSON at all", async () => {
    const answer = (await POST(
      new Request("https://school.test/api", {
        method: "POST",
        body: "not json",
      }),
      { params: Promise.resolve({ channelId: "chan-1" }) },
    )) as unknown as Reply;

    expect((answer as { status: number }).status).toBe(400);
  });

  it("refuses without a session having been consulted", async () => {
    // A malformed body is the client's mistake and needs no session to answer.
    await send({});
    expect(postAsked).toEqual([]);
  });
});

// ── The channel has to be theirs ─────────────────────────────────────────────

describe("whose channel it is", () => {
  it("re-derives the channel against the household", async () => {
    await send({ body: "Bonjour" });
    expect(postAsked).toEqual(["parent-1:chan-1"]);
  });

  it("answers the same 404 as a channel that does not exist", async () => {
    // Whether it exists is not something a caller who cannot reach it should
    // learn.
    canPost = false;
    const answer = await send({ body: "Bonjour" }, "somebody-elses-channel");

    expect((answer as { status: number }).status).toBe(404);
    expect(posted).toEqual([]);
  });

  it("posts as the caller, never as an id from the request", async () => {
    await send({ body: "Bonjour", authorId: "somebody-else" });
    expect(posted[0]).toMatchObject({ authorId: "parent-1", body: "Bonjour" });
  });

  it("posts into the channel named in the path", async () => {
    await send({ body: "Bonjour", channelId: "another" }, "chan-7");
    expect(posted[0]!.channelId).toBe("chan-7");
  });

  it("hands back the new message's id", async () => {
    const answer = await send({ body: "Bonjour" });
    expect(answer).toEqual({ kind: "ok", data: { id: "msg-1" } });
  });
});

// ── What is left to throw ────────────────────────────────────────────────────

describe("a refusal that really is a bug", () => {
  it("logs and answers 500 for a channel closed mid-send", async () => {
    // The sliver between `canPostToChannel` and the write — a moderator closing
    // a channel in the second a parent presses send. Rare enough to be worth a
    // log, and the phone finds it closed on its next poll.
    postOutcome = { ok: false, reason: "ARCHIVED" };
    const answer = await send({ body: "Bonjour" });

    expect((answer as { status: number }).status).toBe(500);
  });
});
