import type { NextResponse } from "next/server";
import { z } from "zod";

import { ForbiddenError } from "@/lib/dal";
import { apiError, preflight, withAuth } from "@/lib/mobile-api";
import { PERMISSIONS } from "@/lib/permissions";
import { listSupplyLists } from "@/modules/supplies/queries";
import { saveList } from "@/modules/supplies/service";

/**
 * The teacher's own demandes de fournitures.
 *
 * `mineOnly` rather than the school-wide read: this screen answers "what have I
 * asked for, and what came back", so a colleague's approved list — rightly on
 * the web screen — is noise here.
 */
export async function GET(): Promise<NextResponse> {
  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.SUPPLY_WRITE)) {
      throw new ForbiddenError(PERMISSIONS.SUPPLY_WRITE);
    }

    return listSupplyLists(context, { canReview: false, mineOnly: true });
  });
}

/**
 * Writes a draft, or rewrites one that was sent back.
 *
 * Saving is not sending: the list stays DRAFT until `submit` is called, so a
 * half-written request never lands on the direction's desk. Every rule about
 * whose list it is and whether it may still be edited lives in `saveList`.
 *
 * Lines carry an article id and no wording — the school decided the wording
 * once, in its catalogue, and a request that could post its own label would be
 * a way around that.
 */
const schema = z.object({
  listId: z.string().min(1).nullish(),
  schoolClassId: z.string().min(1),
  subjectId: z.string().min(1).nullish(),
  title: z.string().trim().min(1).max(160),
  notes: z.string().trim().max(1000).nullish(),
  /** `YYYY-MM-DD`. Absent or null for a list that simply stands. */
  dueOn: z.iso.date().nullish(),
  items: z
    .array(
      z.object({
        articleId: z.string().min(1),
        quantity: z.number().int().min(1).max(999).nullish(),
        notes: z.string().trim().max(300).nullish(),
        isRequired: z.boolean(),
      }),
    )
    .max(100),
});

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError("invalid_request", "Unknown list.", 400);
  }

  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.SUPPLY_WRITE)) {
      throw new ForbiddenError(PERMISSIONS.SUPPLY_WRITE);
    }

    const schoolId = context.currentSchool?.id;
    const schoolYearId = context.currentSchoolYear?.id;
    if (!schoolId || !schoolYearId) return null;

    const result = await saveList({
      authorId: context.user.id,
      schoolId,
      schoolYearId,
      ...(parsed.data.listId ? { listId: parsed.data.listId } : {}),
      schoolClassId: parsed.data.schoolClassId,
      subjectId: parsed.data.subjectId ?? null,
      title: parsed.data.title,
      notes: parsed.data.notes?.trim() || null,
      // The end of that day is put on it by `saveList`, so a deadline set from
      // a phone runs out at the same moment as one set from the office.
      dueOn: parsed.data.dueOn ? new Date(parsed.data.dueOn) : null,
      items: parsed.data.items.map((item) => ({
        articleId: item.articleId,
        quantity: item.quantity ?? null,
        notes: item.notes?.trim() || null,
        isRequired: item.isRequired,
      })),
    });

    if (!result.ok) return { ok: false as const, reason: result.reason };

    return { ok: true as const, listId: result.listId };
  });
}

export { preflight as OPTIONS };
