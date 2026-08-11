import type { NextResponse } from "next/server";

import { ForbiddenError } from "@/lib/dal";
import { preflight, withAuth } from "@/lib/mobile-api";
import { PERMISSIONS } from "@/lib/permissions";
import { findRunRider } from "@/modules/transport/queries";

/**
 * One child on this bus, for the crew standing at the kerb.
 *
 * Behind TRANSPORT_ATTENDANCE rather than TRANSPORT_VIEW: this is the only
 * screen in the app that puts a family's telephone number in front of a driver,
 * and it exists for the moment a child is not where they should be. Whoever may
 * mark the register may make that call; seeing the line alone does not.
 *
 * `findRunRider` binds the subscription to the run's own route and the run to
 * this account's crew, both as `where` clauses — so an id from another bus
 * answers null rather than a child.
 */
export async function GET(
  _request: Request,
  {
    params,
  }: { params: Promise<{ runId: string; subscriptionId: string }> },
): Promise<NextResponse> {
  const { runId, subscriptionId } = await params;

  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.TRANSPORT_ATTENDANCE)) {
      throw new ForbiddenError(PERMISSIONS.TRANSPORT_ATTENDANCE);
    }

    return findRunRider(context, runId, subscriptionId);
  });
}

export { preflight as OPTIONS };
