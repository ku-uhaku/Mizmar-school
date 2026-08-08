import { NextResponse } from "next/server";

import { apiError, preflight, withAuth } from "@/lib/mobile-api";
import { MAX_MESSAGE_LENGTH } from "@/modules/chat/enums";
import { postMessage } from "@/modules/chat/service";
import {
  canPostToChannel,
  loadChannelMessages,
} from "@/modules/portal/queries";

/**
 * Reading and writing one channel.
 *
 * Both verbs re-derive the channel against this household's own list rather
 * than trusting the id in the path — a channel id is guessable, and without
 * that check a parent could read, or post into, another class's conversation by
 * changing one segment of the URL. `loadChannelMessages` answers null for a
 * channel that is not theirs, which `withAuth` turns into the same 404 as one
 * that does not exist.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ channelId: string }> },
): Promise<NextResponse> {
  const { channelId } = await params;
  return withAuth((context) =>
    loadChannelMessages(context.user.id, channelId),
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> },
): Promise<NextResponse> {
  const { channelId } = await params;

  // Read before `withAuth` so the handler stays synchronous in its own scope;
  // a malformed body is the client's mistake and needs no session to answer.
  let body: string;
  try {
    const payload = (await request.json()) as { body?: unknown };
    body = typeof payload.body === "string" ? payload.body : "";
  } catch {
    return apiError("invalid", "Expected a JSON body.", 400);
  }

  /*
    Checked here, where a client mistake is answerable as one.

    `postMessage` refuses an empty or over-long message too, and this used to
    lean on that — but a refusal from inside the handler becomes `PostRefused`,
    which `withAuth` logs and answers 500. So `POST {}` from any client that was
    not the first-party app got a server error and a line in the log, for what
    is plainly a bad request. The rule the rest of the app follows is that an
    expected failure is returned and only a genuine bug throws.

    Measured against the same `MAX_MESSAGE_LENGTH` the service uses, so the two
    cannot disagree about what is too long.
  */
  const trimmed = body.trim();
  if (trimmed === "") {
    return apiError("invalid", "A message needs something in it.", 400);
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return apiError(
      "invalid",
      `A message may run to ${MAX_MESSAGE_LENGTH} characters.`,
      400,
    );
  }

  return withAuth(async (context) => {
    if (!(await canPostToChannel(context.user.id, channelId))) {
      // Null rather than a 403: whether the channel exists is not something a
      // caller who cannot reach it should learn.
      return null;
    }

    const result = await postMessage(channelId, context.user.id, body);
    if (!result.ok) {
      throw new PostRefused(result.reason);
    }
    return { id: result.id };
  });
}

/**
 * Thrown so `withAuth` logs and answers 500, for the reasons that genuinely
 * cannot happen by the time the handler runs.
 *
 * `EMPTY` and `TOO_LONG` are refused above, as the bad requests they are.
 * `NOT_FOUND` cannot arise either: `canPostToChannel` has already resolved the
 * channel against this household. That leaves `ARCHIVED`, in the sliver between
 * that check and the write — a moderator closing a channel in the second a
 * parent presses send. Rare enough to be worth a log, and the phone re-lists
 * the channel on its next poll and finds it closed.
 */
class PostRefused extends Error {
  constructor(reason: string) {
    super(`message refused: ${reason}`);
    this.name = "PostRefused";
  }
}

export { preflight as OPTIONS };
