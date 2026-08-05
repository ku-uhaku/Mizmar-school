import type { NextResponse } from "next/server";
import { z } from "zod";

import { ForbiddenError } from "@/lib/dal";
import { apiError, preflight, withAuth } from "@/lib/mobile-api";
import { PERMISSIONS } from "@/lib/permissions";
import { RIDER_ATTENDANCE_STATUSES } from "@/modules/transport/enums";
import { findMyRun, loadRunRegister } from "@/modules/transport/queries";
import { markRiderOnRun } from "@/modules/transport/service";

/**
 * Who is expected on this run, and who has been marked.
 *
 * Empty until the bus has left — see the note on `loadRunRegister`. The run
 * itself always comes back, so the phone knows whether to offer "démarrer" or
 * the names.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<NextResponse> {
  const { runId } = await params;

  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.TRANSPORT_ATTENDANCE)) {
      throw new ForbiddenError(PERMISSIONS.TRANSPORT_ATTENDANCE);
    }

    return loadRunRegister(context, runId);
  });
}

/**
 * L'appel: one child marked at the kerb, by the driver or the accompagnateur.
 *
 * One rider per call rather than the whole sheet. A bus marks a child as it
 * meets them, over twenty minutes and a patchy signal, and a payload carrying
 * the whole register would make the last write win — quietly undoing the
 * absence flagged three stops earlier.
 *
 * `minutesLate` is accepted only alongside LATE; `markRiderAttendance` clears it
 * for every other status anyway, which is the rule that keeps a retard from
 * surviving a correction to PRESENT.
 */
const schema = z.object({
  subscriptionId: z.string().min(1),
  status: z.enum(RIDER_ATTENDANCE_STATUSES),
  minutesLate: z.number().int().min(0).max(600).nullish(),
  reason: z.string().trim().max(500).nullish(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<NextResponse> {
  const { runId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return apiError("invalid_request", "Unknown mark.", 400);
  }

  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.TRANSPORT_ATTENDANCE)) {
      throw new ForbiddenError(PERMISSIONS.TRANSPORT_ATTENDANCE);
    }

    // The crew link first, so a run that is not this phone's answers 404 before
    // anything is read about the children on it.
    const run = await findMyRun(context, runId);
    if (!run) return null;

    const marked = await markRiderOnRun({
      runId: run.id,
      subscriptionId: parsed.data.subscriptionId,
      status: parsed.data.status,
      minutesLate: parsed.data.minutesLate ?? null,
      reason: parsed.data.reason?.trim() || null,
      recordedById: context.user.id,
      withinWindow: true,
    });
    if (!marked) return null;

    // The sheet as it now stands, so the phone re-renders on the server's
    // answer rather than on what it hoped it wrote.
    return loadRunRegister(context, run.id);
  });
}

export { preflight as OPTIONS };
