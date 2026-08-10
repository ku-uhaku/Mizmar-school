/**
 * What a school charges, what it costs for a year, and what it takes off.
 *
 * Pure data, shared by `modules/billing/seed.ts` and the setup wizard. Amounts
 * are written in dirhams here and converted once, on the way in — the database
 * stores integer centimes.
 */

/** Dirhams as the integer centimes the database stores. */
export const MAD = (dirhams: number): number => Math.round(dirhams * 100);

export type FeeTypePreset = {
  code: string;
  name: string;
  nameAr: string;
  kind: string;
  billingCycle: string;
  isMandatory: boolean;
};

export type FeeRatePreset = {
  feeCode: string;
  /** Null prices the fee the same at every level. */
  levelCode: string | null;
  dirhams: number;
  instalmentCount?: number;
};

export type DiscountPreset = {
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

export const FEE_TYPES: FeeTypePreset[] = [
  { code: "SCOLARITE", name: "Scolarité", nameAr: "الرسوم الدراسية", kind: "TUITION", billingCycle: "MONTHLY", isMandatory: true },
  { code: "INSCRIPTION", name: "Frais d'inscription", nameAr: "رسوم التسجيل", kind: "REGISTRATION", billingCycle: "ONE_OFF", isMandatory: true },
  { code: "ASSURANCE", name: "Assurance scolaire", nameAr: "التأمين المدرسي", kind: "INSURANCE", billingCycle: "ANNUAL", isMandatory: true },
  { code: "FOURNITURES", name: "Fournitures et manuels", nameAr: "اللوازم والكتب", kind: "SUPPLIES", billingCycle: "ANNUAL", isMandatory: true },
  { code: "TRANSPORT", name: "Transport scolaire", nameAr: "النقل المدرسي", kind: "TRANSPORT", billingCycle: "MONTHLY", isMandatory: false },
  { code: "CANTINE", name: "Cantine", nameAr: "المطعم المدرسي", kind: "CANTEEN", billingCycle: "MONTHLY", isMandatory: false },
  { code: "CLUB-FOOT", name: "Club de football", nameAr: "نادي كرة القدم", kind: "CLUB", billingCycle: "ANNUAL", isMandatory: false },
  { code: "CLUB-THEATRE", name: "Club de théâtre", nameAr: "نادي المسرح", kind: "CLUB", billingCycle: "ANNUAL", isMandatory: false },
];

/*
  No rate names its own `instalmentCount`.

  Every monthly rate here used to repeat `instalmentCount: 9`, and a rate's own
  count beats everything — so the school's setting was dead the moment this seed
  ran, and a year that was not September–June had its fee grid cut short with no
  way to say otherwise short of editing nineteen price rows by hand. Leaving it
  null is what lets `SchoolSettings.defaultInstalmentCount` decide, which is the
  reason that column exists. A school with one charge genuinely collected over a
  different number of months still sets it on that rate, which is what the
  override is for.
*/
export const FEE_RATES: FeeRatePreset[] = [
  // Scolarité rises with the cycle — the whole reason a price is per level.
  { feeCode: "SCOLARITE", levelCode: "1AP", dirhams: 15000 },
  { feeCode: "SCOLARITE", levelCode: "2AP", dirhams: 15000 },
  { feeCode: "SCOLARITE", levelCode: "3AP", dirhams: 16000 },
  { feeCode: "SCOLARITE", levelCode: "4AP", dirhams: 16000 },
  { feeCode: "SCOLARITE", levelCode: "5AP", dirhams: 16500 },
  { feeCode: "SCOLARITE", levelCode: "6AP", dirhams: 16500 },
  { feeCode: "SCOLARITE", levelCode: "1AC", dirhams: 19000 },
  { feeCode: "SCOLARITE", levelCode: "2AC", dirhams: 19000 },
  { feeCode: "SCOLARITE", levelCode: "3AC", dirhams: 19500 },
  { feeCode: "SCOLARITE", levelCode: "TC", dirhams: 22000 },
  { feeCode: "SCOLARITE", levelCode: "1BAC", dirhams: 23500 },
  { feeCode: "SCOLARITE", levelCode: "2BAC", dirhams: 25000 },
  // Flat charges, priced once for every level.
  { feeCode: "INSCRIPTION", levelCode: null, dirhams: 1500 },
  { feeCode: "ASSURANCE", levelCode: null, dirhams: 150 },
  { feeCode: "FOURNITURES", levelCode: null, dirhams: 800 },
  { feeCode: "TRANSPORT", levelCode: null, dirhams: 4500 },
  { feeCode: "CANTINE", levelCode: null, dirhams: 6300 },
  { feeCode: "CLUB-FOOT", levelCode: null, dirhams: 900 },
  { feeCode: "CLUB-THEATRE", levelCode: null, dirhams: 700 },
];

export const DISCOUNTS: DiscountPreset[] = [
  { code: "FRATRIE-2", name: "Réduction fratrie — 2e enfant", nameAr: "تخفيض الإخوة — الطفل الثاني", kind: "PERCENTAGE", percentBps: 1000, reason: "SIBLING", feeCode: "SCOLARITE" },
  { code: "FRATRIE-3", name: "Réduction fratrie — 3e enfant et plus", nameAr: "تخفيض الإخوة — الطفل الثالث فما فوق", kind: "PERCENTAGE", percentBps: 2000, reason: "SIBLING", feeCode: "SCOLARITE" },
  { code: "PERSONNEL", name: "Enfant du personnel", nameAr: "أبناء الموظفين", kind: "PERCENTAGE", percentBps: 5000, reason: "STAFF", feeCode: "SCOLARITE" },
  { code: "ANTICIPE", name: "Paiement anticipé de l'année", nameAr: "الأداء المسبق للسنة", kind: "FIXED_AMOUNT", dirhams: 800, reason: "EARLY_PAYMENT", feeCode: "SCOLARITE", isStackable: true },
  { code: "BOURSE", name: "Bourse d'excellence", nameAr: "منحة التفوق", kind: "PERCENTAGE", percentBps: 3000, reason: "MERIT", feeCode: "SCOLARITE" },
  { code: "CAS-SOCIAL", name: "Cas social", nameAr: "حالة اجتماعية", kind: "PERCENTAGE", percentBps: 4000, reason: "HARDSHIP" },
];

