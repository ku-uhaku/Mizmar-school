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

export const REGISTER_SEEDS: RegisterSeed[] = [
  { code: "PRINCIPALE", name: "Caisse principale", nameAr: "الصندوق الرئيسي", position: 1 },
  { code: "SECONDAIRE", name: "Caisse secondaire", nameAr: "الصندوق الثانوي", position: 2 },
];

export type ExpenseCategorySeed = {
  code: string;
  name: string;
  nameAr: string;
  position: number;
};

/** The rubriques a Moroccan private school actually reports on. */
export const EXPENSE_CATEGORY_SEEDS: ExpenseCategorySeed[] = [
  { code: "SALAIRES", name: "Salaires", nameAr: "الأجور", position: 1 },
  { code: "LOYER", name: "Loyer", nameAr: "الكراء", position: 2 },
  { code: "FOURNITURES", name: "Fournitures", nameAr: "اللوازم", position: 3 },
  { code: "ENTRETIEN", name: "Entretien et réparations", nameAr: "الصيانة والإصلاح", position: 4 },
  { code: "CHARGES", name: "Eau, électricité, télécom", nameAr: "الماء والكهرباء والاتصالات", position: 5 },
  { code: "TRANSPORT", name: "Transport scolaire", nameAr: "النقل المدرسي", position: 6 },
  { code: "IMPOTS", name: "Impôts et taxes", nameAr: "الضرائب والرسوم", position: 7 },
  { code: "DIVERS", name: "Divers", nameAr: "مصاريف متنوعة", position: 8 },
];

export async function seedTreasury(
  db: SeedDb,
  schoolId: string,
): Promise<{ registerIdByCode: Record<string, string> }> {
  const registerIdByCode: Record<string, string> = {};

  for (const register of REGISTER_SEEDS) {
    const row = await db.cashRegister.upsert({
      where: { schoolId_code: { schoolId, code: register.code } },
      update: {
        name: register.name,
        nameAr: register.nameAr,
        position: register.position,
      },
      create: {
        schoolId,
        code: register.code,
        name: register.name,
        nameAr: register.nameAr,
        position: register.position,
      },
      select: { id: true },
    });
    registerIdByCode[register.code] = row.id;
  }

  for (const category of EXPENSE_CATEGORY_SEEDS) {
    await db.expenseCategory.upsert({
      where: { schoolId_code: { schoolId, code: category.code } },
      update: {
        name: category.name,
        nameAr: category.nameAr,
        position: category.position,
      },
      create: {
        schoolId,
        code: category.code,
        name: category.name,
        nameAr: category.nameAr,
        position: category.position,
      },
    });
  }

  log(
    "caisse",
    `${REGISTER_SEEDS.length} tills, ${EXPENSE_CATEGORY_SEEDS.length} expense categories`,
  );

  return { registerIdByCode };
}
