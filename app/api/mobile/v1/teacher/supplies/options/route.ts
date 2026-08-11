import type { NextResponse } from "next/server";

import { ForbiddenError } from "@/lib/dal";
import { preflight, withAuth } from "@/lib/mobile-api";
import { PERMISSIONS } from "@/lib/permissions";
import { listMyTeaching } from "@/modules/classroom/queries";
import {
  listSupplyArticles,
  listSubjectChoices,
} from "@/modules/supplies/queries";

/**
 * Everything the request form offers: the school's catalogue, its subjects, and
 * the classes this teacher actually holds.
 *
 * The classes come from `listMyTeaching` rather than the school's class list —
 * a teacher asks for fournitures for a class they teach, and `saveList` checks
 * the class belongs to the school and year anyway.
 */
export async function GET(): Promise<NextResponse> {
  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.SUPPLY_WRITE)) {
      throw new ForbiddenError(PERMISSIONS.SUPPLY_WRITE);
    }

    const [articles, subjects, teaching] = await Promise.all([
      listSupplyArticles(context),
      listSubjectChoices(context),
      listMyTeaching(context),
    ]);

    return { articles, subjects, teaching };
  });
}

export { preflight as OPTIONS };
