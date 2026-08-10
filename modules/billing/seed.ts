import { feeRateScopeKey } from "@/modules/billing/enums";
import {
  DISCOUNTS,
  MAD,
  type FeeRatePreset,
  type FeeTypePreset,
} from "@/modules/billing/presets";
import { log, type SeedDb } from "@/prisma/seed/client";

/** Writes one school's fee catalogue and one year's price list. */

export async function seedFeeTypes(
  db: SeedDb,
  schoolId: string,
  feeTypes: FeeTypePreset[],
): Promise<Record<string, string>> {
  const idByCode: Record<string, string> = {};

  for (const [index, fee] of feeTypes.entries()) {
    const row = await db.feeType.upsert({
      where: { schoolId_code: { schoolId, code: fee.code } },
      update: {
        name: fee.name,
        nameAr: fee.nameAr,
        kind: fee.kind,
        billingCycle: fee.billingCycle,
        isMandatory: fee.isMandatory,
        position: index,
      },
      create: { schoolId, ...fee, position: index },
    });
    idByCode[fee.code] = row.id;
  }

  log("fee types", feeTypes.length);
  return idByCode;
}

export async function seedFeeRatesAndDiscounts(
  db: SeedDb,
  {
    schoolYearId,
    rates,
    feeTypeIdByCode,
    levelIdByCode,
  }: {
    schoolYearId: string;
    rates: FeeRatePreset[];
    feeTypeIdByCode: Record<string, string>;
    levelIdByCode: Record<string, string>;
  },
): Promise<void> {
  let priced = 0;

  for (const rate of rates) {
    const feeTypeId = feeTypeIdByCode[rate.feeCode];
    if (!feeTypeId) continue;
    const levelId = rate.levelCode ? (levelIdByCode[rate.levelCode] ?? null) : null;
    // A level-specific price for a level this school does not run is skipped.
    if (rate.levelCode && !levelId) continue;

    const scopeKey = feeRateScopeKey(levelId);
    await db.feeRate.upsert({
      where: { schoolYearId_feeTypeId_scopeKey: { schoolYearId, feeTypeId, scopeKey } },
      update: {
        amountCentimes: MAD(rate.dirhams),
        instalmentCount: rate.instalmentCount ?? null,
      },
      create: {
        schoolYearId,
        feeTypeId,
        levelId,
        scopeKey,
        amountCentimes: MAD(rate.dirhams),
        instalmentCount: rate.instalmentCount ?? null,
      },
    });
    priced += 1;
  }

  for (const discount of DISCOUNTS) {
    const feeTypeId = discount.feeCode
      ? (feeTypeIdByCode[discount.feeCode] ?? null)
      : null;
    if (discount.feeCode && !feeTypeId) continue;

    const data = {
      name: discount.name,
      nameAr: discount.nameAr,
      kind: discount.kind,
      percentBps: discount.percentBps ?? null,
      amountCentimes: discount.dirhams ? MAD(discount.dirhams) : null,
      reason: discount.reason,
      feeTypeId,
      isStackable: discount.isStackable ?? false,
    };

    await db.discount.upsert({
      where: { schoolYearId_code: { schoolYearId, code: discount.code } },
      update: data,
      create: { schoolYearId, code: discount.code, ...data },
    });
  }

  log("fees priced", `${priced} rates, ${DISCOUNTS.length} discounts`);
}
