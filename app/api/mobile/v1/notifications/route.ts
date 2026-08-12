import { NextResponse } from "next/server";

import { apiError, preflight, withAuth } from "@/lib/mobile-api";
import { db } from "@/lib/db";
import { loadInbox } from "@/modules/notifications/queries";

/**
 * This account's inbox, and marking it read.
 *
 * ── Not under /family ───────────────────────────────────────────────────────
 * Every other route here sits under the space it serves, because every other
 * read is scoped on something that space is about — a household, a class, a
 * bus. An inbox is scoped on the account itself, so it is the same endpoint for
 * a parent, a teacher, a chauffeur and a directrice, and there is nothing to
 * put a space in front of.
 *
 * No permission is asserted for the same reason none is on the web page: you
 * read your own notifications and there is no other set to read. What stops one
 * phone reading another's is the `userId` in the query's `where`, which comes
 * from the Bearer token and never from the request.
 */
export async function GET(): Promise<NextResponse> {
  return withAuth((context) => loadInbox(context));
}

/**
 * Marks one as read, or all of them. The body is `{ "id": "…" }` for one and
 * `{ "all": true }` for the lot; both answer with the refreshed inbox, so the
 * screen renders what the server thinks rather than what it hoped.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let payload: { id?: unknown; all?: unknown };
  try {
    payload = (await request.json()) as { id?: unknown; all?: unknown };
  } catch {
    return apiError("invalid", "Expected a JSON body.", 400);
  }

  const id = typeof payload.id === "string" ? payload.id : null;
  const all = payload.all === true;

  if (!id && !all) {
    return apiError("invalid", "Say which notification, or all of them.", 400);
  }

  return withAuth(async (context) => {
    // `updateMany` with the account in the `where`, exactly as the web action
    // does it: an id belonging to somebody else matches nothing rather than
    // throwing, and whether it exists at all stays none of the caller's
    // business. `readAt: null` keeps the first read's timestamp.
    await db.notification.updateMany({
      where: {
        userId: context.user.id,
        organizationId: context.organization.id,
        readAt: null,
        ...(all ? {} : { id: id as string }),
      },
      data: { readAt: new Date() },
    });

    return loadInbox(context);
  });
}

export { preflight as OPTIONS };
