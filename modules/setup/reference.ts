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
import { idFor, upsertMany } from "@/modules/setup/bulk";
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
 *
 * Written in bulk rather than a row at a time — see `bulk.ts` for why. These
 * lists are two hundred rows on their own, and they are written whatever the
 * school ticked, so they were a fifth of what expired the transaction.
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
  const cityIdByName = await upsertMany(tx.city, {
    where: { schoolId },
    key: ["name"],
    update: ["code", "nameAr", "region"],
    withIds: true,
    rows: MOROCCAN_CITIES.map((town) => ({
      schoolId,
      code: town.code,
      name: town.name,
      nameAr: town.nameAr,
      region: town.region,
    })),
  });
  counts.cities = MOROCCAN_CITIES.length;

  // Only the school's own town's quartiers: a birthplace is anywhere, but an
  // address is where the pupils live. See `seedNeighbourhoods`.
  const cityCode = cityCodeByName(city);
  const cityNameByCode = new Map(MOROCCAN_CITIES.map((town) => [town.code, town.name]));
  const quartiers = cityCode
    ? MOROCCAN_NEIGHBOURHOODS.filter((quartier) => quartier.cityCode === cityCode)
    : [];
  const quartierRows = quartiers.flatMap((quartier) => {
    const cityId = idFor(cityIdByName, cityNameByCode.get(quartier.cityCode));
    if (!cityId) return [];
    return [
      {
        schoolId,
        cityId,
        code: quartier.code,
        name: quartier.name,
        nameAr: quartier.nameAr,
      },
    ];
  });
  await upsertMany(tx.neighbourhood, {
    where: { schoolId },
    key: ["code"],
    update: ["cityId", "name", "nameAr"],
    rows: quartierRows,
  });
  counts.neighbourhoods = quartierRows.length;

  // ── The dossier d'inscription ──────────────────────────────────────────────
  await upsertMany(tx.documentType, {
    where: { schoolId },
    key: ["code"],
    // `isActive` is deliberately absent from the update: a pièce the school
    // stopped asking for must stay withdrawn through a re-run.
    update: ["name", "nameAr", "isRequired", "copies", "notes", "position"],
    rows: DOCUMENT_TYPE_SEEDS.map((piece, index) => ({
      schoolId,
      code: piece.code,
      name: piece.name,
      nameAr: piece.nameAr,
      isRequired: piece.isRequired,
      copies: piece.copies ?? null,
      notes: piece.notes ?? null,
      position: index,
    })),
  });
  counts.documentTypes = DOCUMENT_TYPE_SEEDS.length;

  // ── What a family may ask the school to issue ──────────────────────────────
  await upsertMany(tx.documentRequestType, {
    where: { schoolId },
    key: ["code"],
    update: [
      "name",
      "nameAr",
      "description",
      "descriptionAr",
      "usualDelayDays",
      "requiresReason",
      "position",
    ],
    rows: REQUEST_TYPE_SEEDS.map((type) => ({
      schoolId,
      code: type.code,
      name: type.name,
      nameAr: type.nameAr,
      description: type.description,
      descriptionAr: type.descriptionAr,
      usualDelayDays: type.usualDelayDays,
      requiresReason: type.requiresReason,
      position: type.position,
    })),
  });
  counts.requestTypes = REQUEST_TYPE_SEEDS.length;

  // ── The kinds of contrôle, and the wording beside a mark ───────────────────
  await upsertMany(tx.assessmentType, {
    where: { schoolId },
    key: ["code"],
    update: [
      "name",
      "nameAr",
      "defaultCoefficient",
      "defaultMaxScore",
      "countsTowardAverage",
      "gradesWholeSubject",
      "allowTeacherCreate",
      "colorHex",
      "position",
    ],
    rows: ASSESSMENT_TYPE_SEEDS.map((type) => ({
      schoolId,
      code: type.code,
      name: type.name,
      nameAr: type.nameAr,
      defaultCoefficient: type.defaultCoefficient,
      defaultMaxScore: type.defaultMaxScore,
      countsTowardAverage: type.countsTowardAverage,
      gradesWholeSubject: type.gradesWholeSubject,
      allowTeacherCreate: type.allowTeacherCreate,
      colorHex: type.colorHex,
      position: type.position,
    })),
  });
  counts.assessmentTypes = ASSESSMENT_TYPE_SEEDS.length;

  // No GradingRule seeded here, deliberately: a barème is a head of studies'
  // decision, made once the school's own niveaux exist, not a Moroccan default
  // the wizard can guess. A wizard-configured school marks every kind out of
  // the type's own defaultMaxScore until somebody opens
  // /configuration/academics/grading-rules and says otherwise.

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
  await upsertMany(tx.supplyArticle, {
    where: { schoolId },
    key: ["code"],
    // `isActive` absent for the same reason as the dossier above.
    update: ["name", "nameAr", "category", "defaultQuantity", "notes", "position"],
    rows: SUPPLY_ARTICLE_SEEDS.map((article, index) => ({
      schoolId,
      code: article.code,
      name: article.name,
      nameAr: article.nameAr,
      category: article.category,
      defaultQuantity: article.defaultQuantity,
      notes: article.notes ?? null,
      position: index,
    })),
  });
  counts.supplyArticles = SUPPLY_ARTICLE_SEEDS.length;

  /*
    ── The caisse ─────────────────────────────────────────────────────────────
    The shared coffre only. `seedTreasury` also mints a till per cashier, which
    it can because the seed has already hired the staff — at setup there is
    nobody to hold one, and `holderId` is left null exactly as it is for the
    coffre. A school gives its cashiers their own tills under /configuration.
  */
  await upsertMany(tx.cashRegister, {
    where: { schoolId },
    key: ["code"],
    // Never `holderId`: a till already handed to a cashier keeps its holder.
    update: ["name", "nameAr", "position"],
    rows: REGISTER_SEEDS.map((register) => ({
      schoolId,
      code: register.code,
      name: register.name,
      nameAr: register.nameAr,
      position: register.position,
    })),
  });
  counts.registers = REGISTER_SEEDS.length;

  const categoryIds = await upsertMany(tx.operationCategory, {
    where: { schoolId },
    key: ["code"],
    update: ["name", "nameAr", "kind", "position"],
    withIds: true,
    rows: CATEGORY_SEEDS.map((category) => ({
      schoolId,
      code: category.code,
      name: category.name,
      nameAr: category.nameAr,
      kind: category.kind,
      position: category.position,
    })),
  });
  counts.categories = CATEGORY_SEEDS.length;

  // One write for every rubrique's sous-rubriques at once. The parent id is
  // part of the key rather than the scope, because a sub-code is only unique
  // within its own rubrique — "Divers" exists under several.
  const subcategoryRows = CATEGORY_SEEDS.flatMap((category) => {
    const categoryId = idFor(categoryIds, category.code);
    if (!categoryId) return [];
    return (category.subcategories ?? []).map((sub, index) => ({
      categoryId,
      code: sub.code,
      name: sub.name,
      nameAr: sub.nameAr,
      position: index + 1,
    }));
  });
  const subcategoryIds = await upsertMany(tx.operationSubcategory, {
    where: { category: { schoolId } },
    key: ["categoryId", "code"],
    update: ["name", "nameAr", "position"],
    withIds: true,
    rows: subcategoryRows,
  });
  counts.subcategories = subcategoryRows.length;

  // Les fournisseurs, each pointing at the rubrique its payments post under —
  // the link that makes the factures screen one select instead of two.
  await upsertMany(tx.supplier, {
    where: { schoolId },
    key: ["code"],
    // `isActive` absent: a fournisseur the school stopped using stays retired.
    update: [
      "name",
      "nameAr",
      "kind",
      "defaultCategoryId",
      "defaultSubcategoryId",
      "accountRef",
      "position",
    ],
    rows: SUPPLIER_SEEDS.map((supplier) => {
      const categoryId = supplier.categoryCode
        ? (idFor(categoryIds, supplier.categoryCode) ?? null)
        : null;
      return {
        schoolId,
        code: supplier.code,
        name: supplier.name,
        nameAr: supplier.nameAr,
        kind: supplier.kind,
        defaultCategoryId: categoryId,
        defaultSubcategoryId:
          categoryId && supplier.subcategoryCode
            ? (idFor(subcategoryIds, categoryId, supplier.subcategoryCode) ?? null)
            : null,
        accountRef: supplier.accountRef ?? null,
        position: supplier.position,
      };
    }),
  });
  counts.suppliers = SUPPLIER_SEEDS.length;

  await upsertMany(tx.operationMotif, {
    where: { schoolId },
    key: ["code"],
    update: ["name", "nameAr", "categoryId", "position"],
    rows: MOTIF_SEEDS.map((motif) => ({
      schoolId,
      code: motif.code,
      name: motif.name,
      nameAr: motif.nameAr,
      categoryId: motif.categoryCode ? (idFor(categoryIds, motif.categoryCode) ?? null) : null,
      position: motif.position,
    })),
  });
  counts.motifs = MOTIF_SEEDS.length;

  await upsertMany(tx.bank, {
    where: { schoolId },
    key: ["code"],
    update: ["name", "nameAr", "position"],
    rows: BANK_SEEDS.map((bank) => ({
      schoolId,
      code: bank.code,
      name: bank.name,
      nameAr: bank.nameAr,
      position: bank.position,
    })),
  });
  counts.banks = BANK_SEEDS.length;

  return counts;
}
