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
 * Thrown so `withAuth` logs and answers 500 — deliberately, because every
 * reason it can carry is one the client was told about before posting.
 * `EMPTY` and `TOO_LONG` are checked on the phone against the same
 * `MAX_MESSAGE_LENGTH`, and `ARCHIVED` is on the channel the phone just listed.
 * Reaching here means the two disagree, which is a bug and not a user error.
 */
class PostRefused extends Error {
  constructor(reason: string) {
    super(`message refused: ${reason} (max ${MAX_MESSAGE_LENGTH})`);
    this.name = "PostRefused";
  }
}

export { preflight as OPTIONS };
