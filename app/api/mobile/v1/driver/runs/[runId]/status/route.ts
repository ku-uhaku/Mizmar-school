import type { NextResponse } from "next/server";
import { z } from "zod";

import { ForbiddenError } from "@/lib/dal";
import { apiError, preflight, withAuth } from "@/lib/mobile-api";
import { PERMISSIONS } from "@/lib/permissions";
import { findMyRun, loadRunRegister } from "@/modules/transport/queries";
import { moveTripRun } from "@/modules/transport/service";

/**
 * Le départ et l'arrivée, from the bus.
 *
 * The two moves a crew makes on the road, and only those two: CANCELLED is
 * absent on purpose. Striking a voyage off the day is the supervisory act that
 * leaves a gap somebody is asked about in June, and it stays behind
 * TRANSPORT_MANAGE on the office board — a driver who has broken down rings the
 * school, which is what actually happens.
 *
 * Three gates, none of them here: `findMyRun` re-derives the run through the
 * year *and* the crew link, so an id from a phone reaches only the bus that
 * phone is on; `moveTripRun` consults the transition table; and `withinWindow`
 * makes it re-derive the run's hour inside the transaction. This handler stays
 * as thin as a page — authorize, call the module, return the DTO.
 */

const schema = z.object({
  next: z.enum(["EN_ROUTE", "ARRIVED"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<NextResponse> {
  const { runId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return apiError("invalid_request", "Unknown move.", 400);
  }

  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.TRANSPORT_ATTENDANCE)) {
      throw new ForbiddenError(PERMISSIONS.TRANSPORT_ATTENDANCE);
    }

    const run = await findMyRun(context, runId);
    if (!run) return null;

    const moved = await moveTripRun(
      run.id,
      parsed.data.next,
      context.user.id,
      { withinWindow: true },
    );

    // False means the run had already moved on, or it is not its hour. Answered
    // with the run as it now stands rather than with an error: the phone
    // re-renders on it, and a driver whose colleague pressed first sees the
    // départ that did happen instead of a message about the one that did not.
    const register = await loadRunRegister(context, run.id);
    if (!register) return null;

    return { moved, ...register };
  });
}

export { preflight as OPTIONS };
