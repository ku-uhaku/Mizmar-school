import type { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, preflight, withAuth } from "@/lib/mobile-api";
import {
  listMyRequests,
  resolveRequestSubject,
} from "@/modules/portal/queries";
import { MAX_COPIES, REASON_MAX } from "@/modules/requests/enums";
import { fileRequest } from "@/modules/requests/service";

/**
 * The household's document requests: reading them, and filing a new one.
 *
 * No permission is asserted on either verb, and that is the design — a parent
 * holds none. The authorization is the household scope inside
 * `modules/portal/queries.ts`, which is why a user id goes in rather than an
 * `AuthContext`.
 */
export async function GET(): Promise<NextResponse> {
  return withAuth((context) => listMyRequests(context.user.id));
}

/**
 * Shape only. Whether the child is theirs is settled by
 * `resolveRequestSubject`, and whether the type is one that child's school
 * issues by `fileRequest` — a form is never the authority on what a request may
 * reach.
 */
const schema = z.object({
  studentId: z.string().min(1),
  typeId: z.string().min(1),
  copies: z.number().int().min(1).max(MAX_COPIES),
  reason: z.string().trim().max(REASON_MAX).nullish(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError("invalid_request", "Unknown request.", 400);
  }

  return withAuth(async (context) => {
    // The child is re-derived against this household before anything is
    // written. A student id is guessable; without this, changing one segment of
    // a payload would file a request against another family's child.
    const subject = await resolveRequestSubject(
      context.user.id,
      parsed.data.studentId,
    );
    // Null becomes the same 404 as a child that does not exist — telling the
    // two apart confirms the child is real.
    if (!subject) return null;

    const result = await fileRequest({
      studentId: subject.studentId,
      typeId: parsed.data.typeId,
      copies: parsed.data.copies,
      reason: parsed.data.reason ?? null,
      requestedById: context.user.id,
    });

    if (!result.ok) {
      // Returned rather than thrown: every one of these is something the
      // parent can act on — pick a different paper, say what it is for, or open
      // the request they already have.
      return { ok: false as const, reason: result.reason };
    }

    return { ok: true as const, requestId: result.requestId };
  });
}

export { preflight as OPTIONS };
