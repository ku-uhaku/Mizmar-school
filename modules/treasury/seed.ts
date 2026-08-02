import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * The tills a school collects at and the rubriques it spends under.
 *
 * Deliberately *only* the configuration. No sessions, no receipts and no
 * operations are seeded: a session is a shift somebody held and a receipt is
 * money somebody took, and inventing either would put figures in the ledger
 * that never happened. The demo school opens its own till on the first visit to
 * /caisse, which is also the shortest way to see the screen work.
 *
 * Idempotent — upserted on `(schoolId, code)`, so re-running changes nothing.
 */

export type RegisterSeed = {
  code: string;
  name: string;
  nameAr: string;
  position: number;
};

/**
 * The shared drawer. Held by nobody on purpose: it is the coffre the cashiers
 * transfer into at the end of the day, not anybody's shift.
 *
 * The cashiers' own tills are not listed here — they are generated from whoever
 * may actually collect, one apiece. See `seedTreasury`.
 */
export const REGISTER_SEEDS: RegisterSeed[] = [
  { code: "PRINCIPALE", name: "Caisse principale", nameAr: "الصندوق الرئيسي", position: 1 },
];

export type CategorySeed = {
  code: string;
  name: string;
  nameAr: string;
  /** "IN" | "OUT" | "BOTH" — see modules/treasury/enums.ts. */
  kind: string;
  position: number;
  /** Sub-rubriques, in the order they should appear under their parent. */
  subcategories?: { code: string; name: string; nameAr: string }[];
};

/**
 * The chart a Moroccan private school actually reports on.
 *
 * The OUT rubriques are the ones that were `EXPENSE_CATEGORY_SEEDS` before this
 * table generalised — same codes, so a re-seed lands on the rows the data
 * migration already created rather than adding duplicates beside them. The IN
 * rubriques are new: an encaissement had no rubrique at all, which is why the
 * caisse could only ever report on half of itself.
 */
export const CATEGORY_SEEDS: CategorySeed[] = [
  // ── Money in ──────────────────────────────────────────────────────────────
  {
    code: "SCOLARITE-IN", name: "Encaissement scolarité", nameAr: "تحصيل الرسوم الدراسية",
    kind: "IN", position: 1,
    subcategories: [
      { code: "MENSUALITE", name: "Mensualité", nameAr: "القسط الشهري" },
      { code: "INSCRIPTION", name: "Frais d'inscription", nameAr: "رسوم التسجيل" },
      { code: "ARRIERES", name: "Arriérés", nameAr: "المتأخرات" },
    ],
  },
  {
    code: "SERVICES-IN", name: "Encaissement services", nameAr: "تحصيل الخدمات",
    kind: "IN", position: 2,
    subcategories: [
      { code: "TRANSPORT", name: "Transport", nameAr: "النقل" },
      { code: "CANTINE", name: "Cantine", nameAr: "المطعم" },
      { code: "ACTIVITES", name: "Activités et clubs", nameAr: "الأنشطة والنوادي" },
    ],
  },

  // ── Money out ─────────────────────────────────────────────────────────────
  {
    code: "SALAIRES", name: "Salaires", nameAr: "الأجور", kind: "OUT", position: 10,
    subcategories: [
      { code: "ENSEIGNANTS", name: "Personnel enseignant", nameAr: "هيئة التدريس" },
      { code: "ADMINISTRATIF", name: "Personnel administratif", nameAr: "الموظفون الإداريون" },
      { code: "AVANCES", name: "Avances sur salaire", nameAr: "تسبيقات على الأجر" },
      { code: "CNSS", name: "Charges sociales", nameAr: "التحملات الاجتماعية" },
    ],
  },
  { code: "LOYER", name: "Loyer", nameAr: "الكراء", kind: "OUT", position: 11 },
  {
    code: "FOURNITURES", name: "Fournitures", nameAr: "اللوازم", kind: "OUT", position: 12,
    subcategories: [
      { code: "PAPETERIE", name: "Papeterie", nameAr: "الأدوات المكتبية" },
      { code: "MANUELS", name: "Manuels et livres", nameAr: "الكتب والمقررات" },
      { code: "INFORMATIQUE", name: "Informatique", nameAr: "المعلوميات" },
      { code: "PRODUITS", name: "Produits d'entretien", nameAr: "مواد التنظيف" },
    ],
  },
  {
    code: "ENTRETIEN", name: "Entretien et réparations", nameAr: "الصيانة والإصلاح",
    kind: "OUT", position: 13,
    subcategories: [
      { code: "BATIMENT", name: "Bâtiment", nameAr: "البناية" },
      { code: "VEHICULES", name: "Véhicules", nameAr: "المركبات" },
      { code: "EQUIPEMENT", name: "Équipement", nameAr: "التجهيزات" },
    ],
  },
  {
    code: "CHARGES", name: "Eau, électricité, télécom", nameAr: "الماء والكهرباء والاتصالات",
    kind: "OUT", position: 14,
    subcategories: [
      { code: "EAU", name: "Eau", nameAr: "الماء" },
      { code: "ELECTRICITE", name: "Électricité", nameAr: "الكهرباء" },
      { code: "TELECOM", name: "Téléphone et internet", nameAr: "الهاتف والأنترنت" },
    ],
  },
  { code: "TRANSPORT", name: "Transport scolaire", nameAr: "النقل المدرسي", kind: "OUT", position: 15 },
  { code: "IMPOTS", name: "Impôts et taxes", nameAr: "الضرائب والرسوم", kind: "OUT", position: 16 },

  // ── Both sides ────────────────────────────────────────────────────────────
  { code: "DIVERS", name: "Divers", nameAr: "متنوعات", kind: "BOTH", position: 20 },
  { code: "REGULARISATION", name: "Régularisation", nameAr: "تسوية", kind: "BOTH", position: 21 },
];

/**
 * The motifs a bursar picks instead of typing a label.
 *
 * Those with a `categoryCode` are offered once that rubrique is chosen; those
 * without are always offered. See OperationMotif.categoryId.
 */
export const MOTIF_SEEDS: {
  code: string;
  name: string;
  nameAr: string;
  categoryCode?: string;
  position: number;
}[] = [
  { code: "ACHAT-FOURNITURES", name: "Achat de fournitures", nameAr: "شراء اللوازم", categoryCode: "FOURNITURES", position: 1 },
  { code: "ACHAT-MANUELS", name: "Achat de manuels", nameAr: "شراء الكتب", categoryCode: "FOURNITURES", position: 2 },
  { code: "SALAIRE-MENSUEL", name: "Salaire mensuel", nameAr: "الأجر الشهري", categoryCode: "SALAIRES", position: 3 },
  { code: "AVANCE-SALAIRE", name: "Avance sur salaire", nameAr: "تسبيق على الأجر", categoryCode: "SALAIRES", position: 4 },
  { code: "REPARATION", name: "Réparation", nameAr: "إصلاح", categoryCode: "ENTRETIEN", position: 5 },
  { code: "FACTURE", name: "Règlement de facture", nameAr: "أداء فاتورة", categoryCode: "CHARGES", position: 6 },
  { code: "LOYER-MENSUEL", name: "Loyer mensuel", nameAr: "الكراء الشهري", categoryCode: "LOYER", position: 7 },
  { code: "REMBOURSEMENT", name: "Remboursement", nameAr: "استرجاع", position: 20 },
  { code: "DIVERS", name: "Divers", nameAr: "متنوع", position: 21 },
];

/** The banks a Casablanca school is likely to hold cheques on. */
export const BANK_SEEDS = [
  { code: "AWB", name: "Attijariwafa Bank", nameAr: "التجاري وفا بنك", position: 1 },
  { code: "BP", name: "Banque Populaire", nameAr: "البنك الشعبي", position: 2 },
  { code: "BMCE", name: "Bank of Africa (BMCE)", nameAr: "بنك إفريقيا", position: 3 },
  { code: "BMCI", name: "BMCI", nameAr: "البنك المغربي للتجارة والصناعة", position: 4 },
  { code: "SG", name: "Société Générale Maroc", nameAr: "سوسيتي جنرال المغرب", position: 5 },
  { code: "CIH", name: "CIH Bank", nameAr: "القرض العقاري والسياحي", position: 6 },
  { code: "CAM", name: "Crédit Agricole du Maroc", nameAr: "القرض الفلاحي للمغرب", position: 7 },
  { code: "CDM", name: "Crédit du Maroc", nameAr: "قرض المغرب", position: 8 },
];

/**
 * Les fournisseurs a Moroccan school actually pays every month.
 *
 * `categoryCode` and `subcategoryCode` are what make the factures screen one
 * select: picking Lydec files the payment under "Eau, électricité, télécom →
 * Eau" without anybody choosing. The account numbers are placeholders in the
 * right shape — replace them with the school's real contract numbers.
 */
export const SUPPLIER_SEEDS: {
  code: string;
  name: string;
  nameAr: string;
  kind: string;
  categoryCode?: string;
  subcategoryCode?: string;
  accountRef?: string;
  position: number;
}[] = [
  { code: "LYDEC-EAU", name: "Lydec — Eau", nameAr: "ليديك — الماء", kind: "UTILITY", categoryCode: "CHARGES", subcategoryCode: "EAU", accountRef: "P-0000000", position: 1 },
  { code: "LYDEC-ELEC", name: "Lydec — Électricité", nameAr: "ليديك — الكهرباء", kind: "UTILITY", categoryCode: "CHARGES", subcategoryCode: "ELECTRICITE", accountRef: "P-0000001", position: 2 },
  { code: "IAM", name: "Maroc Telecom", nameAr: "اتصالات المغرب", kind: "UTILITY", categoryCode: "CHARGES", subcategoryCode: "TELECOM", accountRef: "0522000000", position: 3 },
  { code: "BAILLEUR", name: "Bailleur", nameAr: "المكري", kind: "LANDLORD", categoryCode: "LOYER", position: 4 },
  { code: "NETTOYAGE", name: "Société de nettoyage", nameAr: "شركة التنظيف", kind: "SERVICE", categoryCode: "ENTRETIEN", subcategoryCode: "BATIMENT", position: 5 },
  { code: "PAPETERIE", name: "Papeterie", nameAr: "المكتبة", kind: "VENDOR", categoryCode: "FOURNITURES", subcategoryCode: "PAPETERIE", position: 10 },
  { code: "LIBRAIRIE", name: "Librairie scolaire", nameAr: "المكتبة المدرسية", kind: "VENDOR", categoryCode: "FOURNITURES", subcategoryCode: "MANUELS", position: 11 },
  { code: "INFORMATIQUE", name: "Fournisseur informatique", nameAr: "مزوّد المعلوميات", kind: "VENDOR", categoryCode: "FOURNITURES", subcategoryCode: "INFORMATIQUE", position: 12 },
  { code: "DROGUERIE", name: "Droguerie", nameAr: "الدروغري", kind: "VENDOR", categoryCode: "FOURNITURES", subcategoryCode: "PRODUITS", position: 13 },
  { code: "GARAGE", name: "Garage", nameAr: "الميكانيكي", kind: "VENDOR", categoryCode: "ENTRETIEN", subcategoryCode: "VEHICULES", position: 14 },
];

export async function seedTreasury(
  db: SeedDb,
  schoolId: string,
): Promise<{ registerIdByCode: Record<string, string> }> {
  const registerIdByCode: Record<string, string> = {};

  /*
    One drawer per cashier, plus the shared coffre.

    Generated from who may actually take money rather than written down: a
    school that hires a second secretary should get a second till without anyone
    editing this file, and a seeded caisse everybody shares is precisely the
    arrangement the holder rule exists to end. Whoever holds
    TREASURY_COLLECT at this school gets a till named after them.
  */
  const cashiers = await db.user.findMany({
    where: {
      isActive: true,
      memberships: {
        some: {
          schoolId,
          role: { permissions: { some: { permission: { code: "treasury.collect" } } } },
        },
      },
    },
    orderBy: { email: "asc" },
    select: {
      id: true,
      email: true,
      profile: { select: { firstName: true, lastName: true } },
    },
  });

  const perHolder: (RegisterSeed & { holderId: string })[] = cashiers.map(
    (cashier, index) => {
      const name = cashier.profile
        ? `${cashier.profile.firstName} ${cashier.profile.lastName}`.trim()
        : cashier.email;
      return {
        // Keyed on the account rather than on the name: two colleagues may share
        // a surname, and a code has to stay unique and stable.
        code: `CAISSE-${cashier.email.split("@")[0].toUpperCase()}`,
        name: `Caisse ${name}`,
        nameAr: `صندوق ${name}`,
        position: 10 + index,
        holderId: cashier.id,
      };
    },
  );

  const allRegisters: (RegisterSeed & { holderId?: string })[] = [
    ...REGISTER_SEEDS,
    ...perHolder,
  ];

  for (const register of allRegisters) {
    const row = await db.cashRegister.upsert({
      where: { schoolId_code: { schoolId, code: register.code } },
      update: {
        name: register.name,
        nameAr: register.nameAr,
        position: register.position,
        holderId: register.holderId ?? null,
      },
      create: {
        schoolId,
        code: register.code,
        name: register.name,
        nameAr: register.nameAr,
        position: register.position,
        holderId: register.holderId ?? null,
      },
      select: { id: true },
    });
    registerIdByCode[register.code] = row.id;
  }

  // Rubriques and their sub-rubriques. Upserted on the same [schoolId, code]
  // the old expense categories used, so a re-seed after the data migration
  // updates those rows rather than adding a second set beside them.
  const categoryIdByCode: Record<string, string> = {};
  /** Keyed `RUBRIQUE:SOUS-RUBRIQUE` — sub-codes are only unique within a parent. */
  const subcategoryIdByCode: Record<string, string> = {};

  for (const category of CATEGORY_SEEDS) {
    const row = await db.operationCategory.upsert({
      where: { schoolId_code: { schoolId, code: category.code } },
      update: {
        name: category.name,
        nameAr: category.nameAr,
        kind: category.kind,
        position: category.position,
      },
      create: {
        schoolId,
        code: category.code,
        name: category.name,
        nameAr: category.nameAr,
        kind: category.kind,
        position: category.position,
      },
      select: { id: true },
    });
    categoryIdByCode[category.code] = row.id;

    for (const [index, sub] of (category.subcategories ?? []).entries()) {
      const subRow = await db.operationSubcategory.upsert({
        where: {
          categoryId_code: { categoryId: row.id, code: sub.code },
        },
        update: { name: sub.name, nameAr: sub.nameAr, position: index + 1 },
        create: {
          categoryId: row.id,
          code: sub.code,
          name: sub.name,
          nameAr: sub.nameAr,
          position: index + 1,
        },
        select: { id: true },
      });
      subcategoryIdByCode[`${category.code}:${sub.code}`] = subRow.id;
    }
  }

  /*
    Les fournisseurs, each pointing at the rubrique its payments post under.

    That link is the whole reason the factures and achats screens are one
    select: without it the manager would still be choosing a rubrique for the
    water bill every single month.
  */
  for (const supplier of SUPPLIER_SEEDS) {
    const data = {
      name: supplier.name,
      nameAr: supplier.nameAr,
      kind: supplier.kind,
      defaultCategoryId: supplier.categoryCode
        ? (categoryIdByCode[supplier.categoryCode] ?? null)
        : null,
      defaultSubcategoryId:
        supplier.categoryCode && supplier.subcategoryCode
          ? (subcategoryIdByCode[
              `${supplier.categoryCode}:${supplier.subcategoryCode}`
            ] ?? null)
          : null,
      accountRef: supplier.accountRef ?? null,
      position: supplier.position,
    };

    await db.supplier.upsert({
      where: { schoolId_code: { schoolId, code: supplier.code } },
      // `isActive` is deliberately absent: a supplier the school stopped using
      // stays retired through a re-seed.
      update: data,
      create: { schoolId, code: supplier.code, ...data },
    });
  }

  for (const motif of MOTIF_SEEDS) {
    const categoryId = motif.categoryCode
      ? (categoryIdByCode[motif.categoryCode] ?? null)
      : null;
    await db.operationMotif.upsert({
      where: { schoolId_code: { schoolId, code: motif.code } },
      update: {
        name: motif.name,
        nameAr: motif.nameAr,
        categoryId,
        position: motif.position,
      },
      create: {
        schoolId,
        code: motif.code,
        name: motif.name,
        nameAr: motif.nameAr,
        categoryId,
        position: motif.position,
      },
    });
  }

  for (const bank of BANK_SEEDS) {
    await db.bank.upsert({
      where: { schoolId_code: { schoolId, code: bank.code } },
      update: { name: bank.name, nameAr: bank.nameAr, position: bank.position },
      create: {
        schoolId,
        code: bank.code,
        name: bank.name,
        nameAr: bank.nameAr,
        position: bank.position,
      },
    });
  }

  log(
    "caisse",
    `${allRegisters.length} tills (${perHolder.length} held), ` +
      `${CATEGORY_SEEDS.length} rubriques, ${SUPPLIER_SEEDS.length} fournisseurs, ` +
      `${MOTIF_SEEDS.length} motifs, ${BANK_SEEDS.length} banks`,
  );

  return { registerIdByCode };
}
