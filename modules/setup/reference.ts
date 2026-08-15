import "server-only";

import { DEFAULT_APPRECIATION_BANDS } from "@/modules/assessments/enums";
import { ASSESSMENT_TYPE_SEEDS } from "@/modules/assessments/presets";
import { DOCUMENT_TYPE_SEEDS } from "@/modules/documents/presets";
import {
  MOROCCAN_CITIES,
  MOROCCAN_NEIGHBOURHOODS,
  cityCodeByName,
} from "@/modules/geography/presets";
import { REQUEST_TYPE_SEEDS } from "@/modules/requests/presets";
import { SUPPLY_ARTICLE_SEEDS } from "@/modules/supplies/presets";
import {
  BANK_SEEDS,
  CATEGORY_SEEDS,
  MOTIF_SEEDS,
  REGISTER_SEEDS,
  SUPPLIER_SEEDS,
} from "@/modules/treasury/presets";
import type { TxClient } from "@/modules/treasury/service";

/**
 * The lists every school needs before anybody can be entered into it.
 *
 * ── Why the wizard writes these at all ───────────────────────────────────────
 * The wizard used to write the cursus, the calendar, the rooms and the fees and
 * stop there — which is everything a school *decides* and nothing it *refers
 * to*. A school created through the screens therefore opened with an empty town
 * dropdown (so no pupil could be saved with a birthplace), no dossier to ask a
 * family for, no papers a family could ask it for, no kind of contrôle to mark
 * against, and a caisse with no till, no rubrique and no bank to hold a cheque
 * on. `npm run db:seed:config` wrote all of it; the wizard did not, so the two
 * ways of opening a school produced two different schools.
 *
 * This is the missing half, and it is deliberately not a wizard step: none of it
 * is a choice — a school does not decide that Casablanca exists or that a cheque
 * may be drawn on Attijariwafa Bank. Every row is editable under
 * `/configuration` afterwards, which is where a school actually trims these to
 * what it uses.
 *
 * ── Same rows as the seed, from the same lists ───────────────────────────────
 * Every preset here is the module's own `presets.ts`, which is what its
 * `seed.ts` writes too. That shared list is the point: a school configured
 * through the screens and a school configured by `db:seed:config` start from
 * exactly the same references, and neither can drift from the other by a
 * release.
 *
 * Idempotent, like everything else the wizard does: upsert on each table's own
 * unique key, and never delete. Re-running over a school that has trimmed its
 * lists puts back the presets and leaves its own rows alone — with the two
 * exceptions noted below, where a school's edit would otherwise be undone.
 */

export type ReferenceCounts = {
  cities: number;
  neighbourhoods: number;
  documentTypes: number;
  requestTypes: number;
  assessmentTypes: number;
  appreciationBands: number;
  supplyArticles: number;
  registers: number;
  categories: number;
  subcategories: number;
  motifs: number;
  suppliers: number;
  banks: number;
};

export const NO_REFERENCE_COUNTS: ReferenceCounts = {
  cities: 0, neighbourhoods: 0, documentTypes: 0, requestTypes: 0,
  assessmentTypes: 0, appreciationBands: 0, supplyArticles: 0, registers: 0,
  categories: 0, subcategories: 0, motifs: 0, suppliers: 0, banks: 0,
};

// How many of each the review step promises is `REFERENCE_SIZES` in
// `catalogue.ts`: the browser counts them, so it cannot be derived here.

export async function writeReferenceData(
  tx: TxClient,
  schoolId: string,
  /** Where the school says it stands — free text, as `School.city` is. */
  city: string | null,
): Promise<ReferenceCounts> {
  const counts: ReferenceCounts = { ...NO_REFERENCE_COUNTS };

  // ── Towns, and the quartiers of this school's own town ──────────────────────
  // Upserted on the *name* rather than the code, exactly as `seedCities` is and
  // for the same reason: a town already typed into a pupil's file was backfilled
  // under a code derived from its name, and matching on the name hands that row
  // its proper code instead of colliding with it.
  const cityIdByCode: Record<string, string> = {};
  for (const town of MOROCCAN_CITIES) {
    const row = await tx.city.upsert({
      where: { schoolId_name: { schoolId, name: town.name } },
      update: { code: town.code, nameAr: town.nameAr, region: town.region },
      create: {
        schoolId,
        code: town.code,
        name: town.name,
        nameAr: town.nameAr,
        region: town.region,
      },
      select: { id: true },
    });
    cityIdByCode[town.code] = row.id;
    counts.cities += 1;
  }

  // Only the school's own town's quartiers: a birthplace is anywhere, but an
  // address is where the pupils live. See `seedNeighbourhoods`.
  const cityCode = cityCodeByName(city);
  const quartiers = cityCode
    ? MOROCCAN_NEIGHBOURHOODS.filter((quartier) => quartier.cityCode === cityCode)
    : [];
  for (const quartier of quartiers) {
    const cityId = cityIdByCode[quartier.cityCode];
    if (!cityId) continue;

    await tx.neighbourhood.upsert({
      where: { schoolId_code: { schoolId, code: quartier.code } },
      update: { cityId, name: quartier.name, nameAr: quartier.nameAr },
      create: {
        schoolId,
        cityId,
        code: quartier.code,
        name: quartier.name,
        nameAr: quartier.nameAr,
      },
    });
    counts.neighbourhoods += 1;
  }

  // ── The dossier d'inscription ──────────────────────────────────────────────
  for (const [index, piece] of DOCUMENT_TYPE_SEEDS.entries()) {
    const data = {
      name: piece.name,
      nameAr: piece.nameAr,
      isRequired: piece.isRequired,
      copies: piece.copies ?? null,
      notes: piece.notes ?? null,
      position: index,
    };
    await tx.documentType.upsert({
      where: { schoolId_code: { schoolId, code: piece.code } },
      // `isActive` is deliberately absent from the update: a pièce the school
      // stopped asking for must stay withdrawn through a re-run.
      update: data,
      create: { schoolId, code: piece.code, ...data },
    });
    counts.documentTypes += 1;
  }

  // ── What a family may ask the school to issue ──────────────────────────────
  for (const type of REQUEST_TYPE_SEEDS) {
    const data = {
      name: type.name,
      nameAr: type.nameAr,
      description: type.description,
      descriptionAr: type.descriptionAr,
      usualDelayDays: type.usualDelayDays,
      requiresReason: type.requiresReason,
      position: type.position,
    };
    await tx.documentRequestType.upsert({
      where: { schoolId_code: { schoolId, code: type.code } },
      update: data,
      create: { schoolId, code: type.code, ...data },
    });
    counts.requestTypes += 1;
  }

  // ── The kinds of contrôle, and the wording beside a mark ───────────────────
  for (const type of ASSESSMENT_TYPE_SEEDS) {
    const data = {
      name: type.name,
      nameAr: type.nameAr,
      defaultCoefficient: type.defaultCoefficient,
      defaultMaxScore: type.defaultMaxScore,
      countsTowardAverage: type.countsTowardAverage,
      gradesWholeSubject: type.gradesWholeSubject,
      allowTeacherCreate: type.allowTeacherCreate,
      colorHex: type.colorHex,
      position: type.position,
    };
    await tx.assessmentType.upsert({
      where: { schoolId_code: { schoolId, code: type.code } },
      update: data,
      create: { schoolId, code: type.code, ...data },
    });
    counts.assessmentTypes += 1;
  }

  /*
    The appréciation scale, written only into a school that has none.

    The wording is the whole point of the table — a school rewrites "Assez bien"
    to whatever its own bulletins say — so an upsert here would put the default
    back every time somebody re-ran the wizard and quietly undo that. A school
    that deleted every rung has said it wants no suggested remark, and leaving it
    empty is the honest answer. Same rule as `seedAppreciationBands`.
  */
  const bands = await tx.appreciationBand.count({ where: { schoolId } });
  if (bands === 0) {
    await tx.appreciationBand.createMany({
      data: DEFAULT_APPRECIATION_BANDS.map((band) => ({
        schoolId,
        minPercentBps: band.minPercentBps,
        label: band.label,
        labelAr: band.labelAr,
        colorHex: band.colorHex,
      })),
    });
    counts.appreciationBands = DEFAULT_APPRECIATION_BANDS.length;
  }

  // ── The articles a liste de fournitures may name ───────────────────────────
  for (const [index, article] of SUPPLY_ARTICLE_SEEDS.entries()) {
    const data = {
      name: article.name,
      nameAr: article.nameAr,
      category: article.category,
      defaultQuantity: article.defaultQuantity,
      notes: article.notes ?? null,
      position: index,
    };
    await tx.supplyArticle.upsert({
      where: { schoolId_code: { schoolId, code: article.code } },
      // `isActive` absent for the same reason as the dossier above.
      update: data,
      create: { schoolId, code: article.code, ...data },
    });
    counts.supplyArticles += 1;
  }

  /*
    ── The caisse ─────────────────────────────────────────────────────────────
    The shared coffre only. `seedTreasury` also mints a till per cashier, which
    it can because the seed has already hired the staff — at setup there is
    nobody to hold one, and `holderId` is left null exactly as it is for the
    coffre. A school gives its cashiers their own tills under /configuration.
  */
  for (const register of REGISTER_SEEDS) {
    const data = {
      name: register.name,
      nameAr: register.nameAr,
      position: register.position,
    };
    await tx.cashRegister.upsert({
      where: { schoolId_code: { schoolId, code: register.code } },
      // Never `holderId`: a till already handed to a cashier keeps its holder.
      update: data,
      create: { schoolId, code: register.code, ...data },
    });
    counts.registers += 1;
  }

  const categoryIdByCode: Record<string, string> = {};
  /** Keyed `RUBRIQUE:SOUS-RUBRIQUE` — sub-codes are only unique within a parent. */
  const subcategoryIdByCode: Record<string, string> = {};

  for (const category of CATEGORY_SEEDS) {
    const row = await tx.operationCategory.upsert({
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
    counts.categories += 1;

    for (const [index, sub] of (category.subcategories ?? []).entries()) {
      const subRow = await tx.operationSubcategory.upsert({
        where: { categoryId_code: { categoryId: row.id, code: sub.code } },
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
      counts.subcategories += 1;
    }
  }

  // Les fournisseurs, each pointing at the rubrique its payments post under —
  // the link that makes the factures screen one select instead of two.
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
    await tx.supplier.upsert({
      where: { schoolId_code: { schoolId, code: supplier.code } },
      // `isActive` absent: a fournisseur the school stopped using stays retired.
      update: data,
      create: { schoolId, code: supplier.code, ...data },
    });
    counts.suppliers += 1;
  }

  for (const motif of MOTIF_SEEDS) {
    const data = {
      name: motif.name,
      nameAr: motif.nameAr,
      categoryId: motif.categoryCode
        ? (categoryIdByCode[motif.categoryCode] ?? null)
        : null,
      position: motif.position,
    };
    await tx.operationMotif.upsert({
      where: { schoolId_code: { schoolId, code: motif.code } },
      update: data,
      create: { schoolId, code: motif.code, ...data },
    });
    counts.motifs += 1;
  }

  for (const bank of BANK_SEEDS) {
    const data = { name: bank.name, nameAr: bank.nameAr, position: bank.position };
    await tx.bank.upsert({
      where: { schoolId_code: { schoolId, code: bank.code } },
      update: data,
      create: { schoolId, code: bank.code, ...data },
    });
    counts.banks += 1;
  }

  return counts;
}
