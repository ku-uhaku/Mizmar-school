import { NextResponse } from "next/server";

import { apiError, preflight, withAuth } from "@/lib/mobile-api";
import { loadBadges, markTopicSeen } from "@/modules/portal/queries";

/**
 * What is new for this household, and stamping it as read.
 *
 * No permission is asserted — a parent holds none. Every count is scoped on the
 * household inside the query, and each reuses the same read as the screen it
 * sends you to, so a badge cannot promise something the screen will not show.
 */
export async function GET(): Promise<NextResponse> {
  return withAuth((context) => loadBadges(context.user.id));
}

/** Marks one topic read. The body is `{ "topic": "CHAT" }`. */
export async function POST(request: Request): Promise<NextResponse> {
  let topic: string;
  try {
    const payload = (await request.json()) as { topic?: unknown };
    topic = typeof payload.topic === "string" ? payload.topic : "";
  } catch {
    return apiError("invalid", "Expected a JSON body.", 400);
  }

  return withAuth(async (context) => {
    // An unknown topic is ignored rather than refused — `markTopicSeen` checks
    // it against the catalogue, and a client sending one the server has not
    // heard of is a version skew, not an attack worth a 400.
    await markTopicSeen(context.user.id, topic);
    return loadBadges(context.user.id);
  });
}

export { preflight as OPTIONS };
