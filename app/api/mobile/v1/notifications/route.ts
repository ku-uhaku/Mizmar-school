import { NextResponse } from "next/server";

import { apiError, preflight, withAuth } from "@/lib/mobile-api";
import {
  isNotificationKind,
  type NotificationKind,
} from "@/modules/notifications/enums";
import { loadInbox } from "@/modules/notifications/queries";
import { markRead, type ReadSelector } from "@/modules/notifications/service";

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
/**
 * One page of the inbox, newest first.
 *
 * `?cursor=` is the id of the last row the phone already has — it scrolls to
 * the bottom and asks for what comes after. Absent on the first page, and the
 * answer carries `nextCursor: null` once there is nothing older.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const cursor = new URL(request.url).searchParams.get("cursor");
  return withAuth((context) => loadInbox(context, { cursor }));
}

/**
 * Marks notifications read. Three forms, all answering with the refreshed inbox
 * so the screen renders what the server thinks rather than what it hoped:
 *
 *   { "id": "…" }                                  one line
 *   { "all": true }                                the lot
 *   { "studentId": "…", "kinds": ["…"] }           what one screen is about
 *
 * The third exists because reading the screen *is* reading the notification: a
 * parent who opens their child's absences has seen the absence, and being told
 * about it again on the bell afterwards is the app disagreeing with itself. The
 * kinds travel from the client rather than being derived here because it is the
 * client that knows which screen was opened — and an unknown one is dropped
 * below rather than refused, since an old app naming a kind this build has never
 * heard of is version skew, not an attack.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let payload: {
    id?: unknown;
    all?: unknown;
    studentId?: unknown;
    kinds?: unknown;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return apiError("invalid", "Expected a JSON body.", 400);
  }

  const studentId =
    typeof payload.studentId === "string" ? payload.studentId : null;
  const kinds = Array.isArray(payload.kinds)
    ? payload.kinds.filter(
        (kind): kind is NotificationKind =>
          typeof kind === "string" && isNotificationKind(kind),
      )
    : [];

  const selector: ReadSelector | null =
    payload.all === true
      ? { all: true }
      : typeof payload.id === "string"
        ? { id: payload.id }
        : studentId !== null && kinds.length > 0
          ? { studentId, kinds }
          : null;

  if (!selector) {
    return apiError("invalid", "Say which notifications to mark read.", 400);
  }

  return withAuth(async (context) => {
    await markRead(
      { userId: context.user.id, organizationId: context.organization.id },
      selector,
    );

    return loadInbox(context);
  });
}

export { preflight as OPTIONS };
