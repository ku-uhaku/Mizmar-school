import { SUPPLY_ARTICLE_SEEDS } from "@/modules/supplies/presets";
import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * The catalogue written for one school, and the demonstration's lists.
 *
 * The articles themselves are `presets.ts`. Idempotent: upserted on
 * `(schoolId, code)`, and never deleted — an article a school withdrew by hand
 * stays withdrawn through a re-seed.
 */

export async function seedSupplyArticles(
  db: SeedDb,
  schoolId: string,
): Promise<number> {
  for (const [index, seed] of SUPPLY_ARTICLE_SEEDS.entries()) {
    const data = {
      name: seed.name,
      nameAr: seed.nameAr,
      category: seed.category,
      defaultQuantity: seed.defaultQuantity,
      notes: seed.notes ?? null,
      position: index,
    };

    await db.supplyArticle.upsert({
      where: { schoolId_code: { schoolId, code: seed.code } },
      // `isActive` is deliberately absent from the update: an article the
      // school withdrew by hand must stay withdrawn through a re-seed.
      update: data,
      create: { schoolId, code: seed.code, ...data },
    });
  }

  log("supply catalogue", `${SUPPLY_ARTICLE_SEEDS.length} articles`);
  return SUPPLY_ARTICLE_SEEDS.length;
}

// ── Les listes ───────────────────────────────────────────────────────────────

/**
 * An approved liste de fournitures per class, plus one per subject for the
 * classes that need it.
 *
 * The catalogue above is what a school *may* ask for; a list is what one class
 * *is* asked for, and without one the parent's Fournitures screen has nothing
 * to show — which is a real state, but not one worth demonstrating.
 *
 * Approved on purpose: DRAFT and REJECTED are the interesting states for the
 * staff screens and the wrong ones here, since only APPROVED reaches a family
 * — see `isVisibleToFamilies`.
 */
type SupplyListSeed = {
  title: string;
  /** Subject code, or null for the class's general list. */
  subjectCode: string | null;
  notes: string | null;
  /** Article codes, and what is asked for. */
  items: { code: string; quantity?: number | null; isRequired?: boolean }[];
};

const LIST_SEEDS: SupplyListSeed[] = [
  {
    title: "Liste de rentrée",
    subjectCode: null,
    notes: "À apporter le jour de la rentrée, marqué au nom de l'élève.",
    items: [
      { code: "CAHIER-96-GC", quantity: 4 },
      { code: "CAHIER-48", quantity: 3 },
      { code: "STYLO-BLEU", quantity: 3 },
      { code: "STYLO-ROUGE", quantity: 2 },
      { code: "CRAYON-HB", quantity: 3 },
      { code: "GOMME", quantity: 2 },
      { code: "TAILLE-CRAYON", quantity: 1 },
      { code: "CRAYONS-COUL", quantity: null },
      // Not everything on a list is compulsory, and the screen marks the
      // difference — a parent who cannot see it buys the lot.
      { code: "SURLIGNEUR", quantity: 2, isRequired: false },
    ],
  },
];

export async function seedSupplyLists(
  db: SeedDb,
  {
    schoolId,
    schoolYearId,
    classIds,
    authorId,
  }: {
    schoolId: string;
    schoolYearId: string;
    /** The classes to give a list to. */
    classIds: string[];
    /** Who wrote and released it. */
    authorId: string | null;
  },
): Promise<number> {
  const articles = await db.supplyArticle.findMany({
    where: { schoolId },
    select: { id: true, code: true, name: true, nameAr: true, defaultQuantity: true },
  });
  const byCode = new Map(articles.map((article) => [article.code, article]));

  let written = 0;

  for (const schoolClassId of classIds) {
    for (const seed of LIST_SEEDS) {
      /*
        Upserted on (class, year, title): a list carries no natural code, and
        the title is what a school would notice it had entered twice. Re-running
        therefore corrects a list rather than raising a second one.
      */
      const existing = await db.supplyList.findFirst({
        where: { schoolClassId, schoolYearId, title: seed.title },
        select: { id: true },
      });

      const listId =
        existing?.id ??
        (
          await db.supplyList.create({
            data: {
              schoolId,
              schoolYearId,
              schoolClassId,
              title: seed.title,
              notes: seed.notes,
              status: "APPROVED",
              authorId,
              reviewedById: authorId,
              reviewedAt: new Date(),
            },
            select: { id: true },
          })
        ).id;

      // Replaced wholesale rather than diffed: a handful of rows with nothing
      // hanging off them, and a delete-then-write cannot leave half a list.
      await db.supplyItem.deleteMany({ where: { listId } });
      await db.supplyItem.createMany({
        data: seed.items.flatMap((item, index) => {
          const article = byCode.get(item.code);
          if (!article) return [];
          return [
            {
              listId,
              articleId: article.id,
              label: article.name,
              labelAr: article.nameAr,
              quantity:
                item.quantity === undefined
                  ? article.defaultQuantity
                  : item.quantity,
              isRequired: item.isRequired ?? true,
              position: index,
            },
          ];
        }),
      });

      written += 1;
    }
  }

  log("supply lists", written);
  return written;
}
