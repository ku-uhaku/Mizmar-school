import { feeRateScopeKey } from "@/modules/billing/enums";
import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * What each school charges, what it costs this year, and what it takes off.
 *
 * Amounts are written in dirhams here and converted once, on the way in — the
 * database stores integer centimes.
 */

const MAD = (dirhams: number) => Math.round(dirhams * 100);

export type FeeTypeSeed = {
  code: string;
  name: string;
  nameAr: string;
  kind: string;
  billingCycle: string;
  isMandatory: boolean;
};

export type FeeRateSeed = {
  feeCode: string;
  /** Null prices the fee the same at every level. */
  levelCode: string | null;
  dirhams: number;
  instalmentCount?: number;
};

export type DiscountSeed = {
  code: string;
  name: string;
  nameAr: string;
  kind: string;
  percentBps?: number;
  dirhams?: number;
  reason: string;
  feeCode?: string;
  isStackable?: boolean;
};

export const FULL_RANGE_FEES: FeeTypeSeed[] = [
  { code: "SCOLARITE", name: "Scolarité", nameAr: "الرسوم الدراسية", kind: "TUITION", billingCycle: "MONTHLY", isMandatory: true },
  { code: "INSCRIPTION", name: "Frais d'inscription", nameAr: "رسوم التسجيل", kind: "REGISTRATION", billingCycle: "ONE_OFF", isMandatory: true },
  { code: "ASSURANCE", name: "Assurance scolaire", nameAr: "التأمين المدرسي", kind: "INSURANCE", billingCycle: "ANNUAL", isMandatory: true },
  { code: "FOURNITURES", name: "Fournitures et manuels", nameAr: "اللوازم والكتب", kind: "SUPPLIES", billingCycle: "ANNUAL", isMandatory: true },
  { code: "TRANSPORT", name: "Transport scolaire", nameAr: "النقل المدرسي", kind: "TRANSPORT", billingCycle: "MONTHLY", isMandatory: false },
  { code: "CANTINE", name: "Cantine", nameAr: "المطعم المدرسي", kind: "CANTEEN", billingCycle: "MONTHLY", isMandatory: false },
  { code: "CLUB-FOOT", name: "Club de football", nameAr: "نادي كرة القدم", kind: "CLUB", billingCycle: "ANNUAL", isMandatory: false },
  { code: "CLUB-THEATRE", name: "Club de théâtre", nameAr: "نادي المسرح", kind: "CLUB", billingCycle: "ANNUAL", isMandatory: false },
];

export const FULL_RANGE_RATES: FeeRateSeed[] = [
  // Scolarité rises with the cycle — the whole reason a price is per level.
  { feeCode: "SCOLARITE", levelCode: "1AP", dirhams: 15000, instalmentCount: 9 },
  { feeCode: "SCOLARITE", levelCode: "2AP", dirhams: 15000, instalmentCount: 9 },
  { feeCode: "SCOLARITE", levelCode: "3AP", dirhams: 16000, instalmentCount: 9 },
  { feeCode: "SCOLARITE", levelCode: "4AP", dirhams: 16000, instalmentCount: 9 },
  { feeCode: "SCOLARITE", levelCode: "5AP", dirhams: 16500, instalmentCount: 9 },
  { feeCode: "SCOLARITE", levelCode: "6AP", dirhams: 16500, instalmentCount: 9 },
  { feeCode: "SCOLARITE", levelCode: "1AC", dirhams: 19000, instalmentCount: 9 },
  { feeCode: "SCOLARITE", levelCode: "2AC", dirhams: 19000, instalmentCount: 9 },
  { feeCode: "SCOLARITE", levelCode: "3AC", dirhams: 19500, instalmentCount: 9 },
  { feeCode: "SCOLARITE", levelCode: "TC", dirhams: 22000, instalmentCount: 9 },
  { feeCode: "SCOLARITE", levelCode: "1BAC", dirhams: 23500, instalmentCount: 9 },
  { feeCode: "SCOLARITE", levelCode: "2BAC", dirhams: 25000, instalmentCount: 9 },
  // Flat charges, priced once for every level.
  { feeCode: "INSCRIPTION", levelCode: null, dirhams: 1500 },
  { feeCode: "ASSURANCE", levelCode: null, dirhams: 150 },
  { feeCode: "FOURNITURES", levelCode: null, dirhams: 800 },
  { feeCode: "TRANSPORT", levelCode: null, dirhams: 4500, instalmentCount: 9 },
  { feeCode: "CANTINE", levelCode: null, dirhams: 6300, instalmentCount: 9 },
  { feeCode: "CLUB-FOOT", levelCode: null, dirhams: 900 },
  { feeCode: "CLUB-THEATRE", levelCode: null, dirhams: 700 },
];

export const PRIMARY_ONLY_FEES: FeeTypeSeed[] = [
  { code: "SCOLARITE", name: "Scolarité", nameAr: "الرسوم الدراسية", kind: "TUITION", billingCycle: "MONTHLY", isMandatory: true },
  { code: "INSCRIPTION", name: "Frais d'inscription", nameAr: "رسوم التسجيل", kind: "REGISTRATION", billingCycle: "ONE_OFF", isMandatory: true },
  { code: "ASSURANCE", name: "Assurance scolaire", nameAr: "التأمين المدرسي", kind: "INSURANCE", billingCycle: "ANNUAL", isMandatory: true },
  { code: "CANTINE", name: "Cantine", nameAr: "المطعم المدرسي", kind: "CANTEEN", billingCycle: "MONTHLY", isMandatory: false },
  { code: "CLUB-ARTS", name: "Club d'arts plastiques", nameAr: "نادي الفنون التشكيلية", kind: "CLUB", billingCycle: "ANNUAL", isMandatory: false },
];

export const PRIMARY_ONLY_RATES: FeeRateSeed[] = [
  { feeCode: "SCOLARITE", levelCode: "MS", dirhams: 11000, instalmentCount: 10 },
  { feeCode: "SCOLARITE", levelCode: "GS", dirhams: 12000, instalmentCount: 10 },
  { feeCode: "SCOLARITE", levelCode: "1AP", dirhams: 14000, instalmentCount: 10 },
  { feeCode: "SCOLARITE", levelCode: "2AP", dirhams: 14000, instalmentCount: 10 },
  { feeCode: "SCOLARITE", levelCode: "3AP", dirhams: 14500, instalmentCount: 10 },
  { feeCode: "SCOLARITE", levelCode: "4AP", dirhams: 14500, instalmentCount: 10 },
  { feeCode: "SCOLARITE", levelCode: "5AP", dirhams: 15000, instalmentCount: 10 },
  { feeCode: "SCOLARITE", levelCode: "6AP", dirhams: 15000, instalmentCount: 10 },
  { feeCode: "INSCRIPTION", levelCode: null, dirhams: 1200 },
  { feeCode: "ASSURANCE", levelCode: null, dirhams: 150 },
  { feeCode: "CANTINE", levelCode: null, dirhams: 5400, instalmentCount: 10 },
  { feeCode: "CLUB-ARTS", levelCode: null, dirhams: 700 },
];

export const DISCOUNTS: DiscountSeed[] = [
  { code: "FRATRIE-2", name: "Réduction fratrie — 2e enfant", nameAr: "تخفيض الإخوة — الطفل الثاني", kind: "PERCENTAGE", percentBps: 1000, reason: "SIBLING", feeCode: "SCOLARITE" },
  { code: "FRATRIE-3", name: "Réduction fratrie — 3e enfant et plus", nameAr: "تخفيض الإخوة — الطفل الثالث فما فوق", kind: "PERCENTAGE", percentBps: 2000, reason: "SIBLING", feeCode: "SCOLARITE" },
  { code: "PERSONNEL", name: "Enfant du personnel", nameAr: "أبناء الموظفين", kind: "PERCENTAGE", percentBps: 5000, reason: "STAFF", feeCode: "SCOLARITE" },
  { code: "ANTICIPE", name: "Paiement anticipé de l'année", nameAr: "الأداء المسبق للسنة", kind: "FIXED_AMOUNT", dirhams: 800, reason: "EARLY_PAYMENT", feeCode: "SCOLARITE", isStackable: true },
  { code: "BOURSE", name: "Bourse d'excellence", nameAr: "منحة التفوق", kind: "PERCENTAGE", percentBps: 3000, reason: "MERIT", feeCode: "SCOLARITE" },
  { code: "CAS-SOCIAL", name: "Cas social", nameAr: "حالة اجتماعية", kind: "PERCENTAGE", percentBps: 4000, reason: "HARDSHIP" },
];

export async function seedFeeTypes(
  db: SeedDb,
  schoolId: string,
  feeTypes: FeeTypeSeed[],
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
    rates: FeeRateSeed[];
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
