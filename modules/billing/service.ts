import "server-only";

import { db } from "@/lib/db";

/**
 * Writes and invariants for the billing module.
 *
 * Billing has almost none: what a family owes is decided on the échéancier, and
 * a FeeRate is a number a bursar types. What lives here is the one thing that
 * is a rule rather than a form — carrying a price list into a new year.
 */

/**
 * Copies a year's price list and its reductions onto another year.
 *
 * ── At last year's amounts, deliberately ────────────────────────────────────
 * Nothing is uprated. A school raises its fees by a figure it decides in a
 * meeting, not by a rule this code could guess, and a silent increase is the
 * one mistake nobody would catch until a parent queried a receipt. Copying the
 * grid saves the typing; re-pricing stays a decision.
 *
 * Idempotent: rates upsert on `(schoolYearId, feeTypeId, scopeKey)` and
 * discounts on `(schoolYearId, code)`, and an existing row is left exactly as
 * it is. Running the copy twice, or running it onto a year somebody has already
 * started editing, never overwrites what they typed.
 *
 * `scopeKey` is carried across rather than recomputed: it mirrors `levelId`,
 * which is copied unchanged, so the source's key is already correct — and both
 * years point at the same Level rows, since levels belong to the school and not
 * to a year.
 */
export async function copyFeeConfiguration(
  sourceYearId: string,
  targetYearId: string,
): Promise<{ rates: number; discounts: number }> {
  const [rates, discounts] = await Promise.all([
    db.feeRate.findMany({ where: { schoolYearId: sourceYearId } }),
    db.discount.findMany({ where: { schoolYearId: sourceYearId } }),
  ]);

  // Counted as a before/after delta rather than by inspecting each upsert:
  // `update: {}` leaves `updatedAt` untouched, so a row that already existed
  // and was never edited is indistinguishable from a fresh one by its
  // timestamps. The delta is the only honest answer, and these numbers are
  // shown to whoever pressed the button.
  const ratesBefore = await db.feeRate.count({
    where: { schoolYearId: targetYearId },
  });
  for (const rate of rates) {
    await db.feeRate.upsert({
      where: {
        schoolYearId_feeTypeId_scopeKey: {
          schoolYearId: targetYearId,
          feeTypeId: rate.feeTypeId,
          scopeKey: rate.scopeKey,
        },
      },
      update: {},
      create: {
        schoolYearId: targetYearId,
        feeTypeId: rate.feeTypeId,
        levelId: rate.levelId,
        amountCentimes: rate.amountCentimes,
        instalmentCount: rate.instalmentCount,
        isActive: rate.isActive,
        notes: rate.notes,
        scopeKey: rate.scopeKey,
      },
      select: { id: true },
    });
  }
  const copiedRates =
    (await db.feeRate.count({ where: { schoolYearId: targetYearId } })) -
    ratesBefore;

  const discountsBefore = await db.discount.count({
    where: { schoolYearId: targetYearId },
  });
  for (const discount of discounts) {
    await db.discount.upsert({
      where: {
        schoolYearId_code: { schoolYearId: targetYearId, code: discount.code },
      },
      update: {},
      create: {
        schoolYearId: targetYearId,
        code: discount.code,
        name: discount.name,
        nameAr: discount.nameAr,
        kind: discount.kind,
        percentBps: discount.percentBps,
        amountCentimes: discount.amountCentimes,
        reason: discount.reason,
        feeTypeId: discount.feeTypeId,
        isStackable: discount.isStackable,
        isActive: discount.isActive,
        notes: discount.notes,
      },
      select: { id: true },
    });
  }
  const copiedDiscounts =
    (await db.discount.count({ where: { schoolYearId: targetYearId } })) -
    discountsBefore;

  return { rates: copiedRates, discounts: copiedDiscounts };
}
