import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * Dossiers familiaux: a household, its father and mother, and the odd tuteur.
 *
 * Idempotent — upserted on `(schoolId, code)`, so re-running changes nothing and
 * a dossier added by hand survives. Guardians are upserted through a find-then-
 * write on `(familyId, relationship)`, because a father has no unique index of
 * his own (a family may have several tuteurs — see SINGULAR_RELATIONSHIPS).
 *
 * The dossiers themselves are built by `prisma/seed/roster.ts`, which sizes them
 * to the classes the school opens. This file only knows how to write one.
 */

export type FamilySeed = {
  /** Dossier number, and the key the seed is idempotent on. */
  code: string;
  name: string;
  nameAr: string;
  situation: string;
  city: string;
  addressLine: string;
  phone: string;
  father?: { first: string; last: string; profession: string; phone: string };
  mother?: { first: string; last: string; profession: string; phone: string };
  guardian?: { first: string; last: string; profession: string; phone: string };
};

export async function seedFamilies(
  db: SeedDb,
  schoolId: string,
  families: FamilySeed[],
): Promise<Record<string, string>> {
  const idByCode: Record<string, string> = {};
  let guardianCount = 0;

  /*
    The professions this roster actually names, as the school's own list.

    Built from the data rather than from a fixed catalogue: a seed that wrote
    forty rows nobody holds would leave the picker full of professions the demo
    never uses, and one that wrote none would leave it empty. Upserted on
    `(schoolId, code)`, so re-running corrects a wording instead of raising a
    second row.
  */
  const jobIdByName = new Map<string, string>();
  const jobFor = async (name: string): Promise<string> => {
    const held = jobIdByName.get(name);
    if (held) return held;

    const row = await db.parentJob.upsert({
      where: {
        schoolId_code: {
          schoolId,
          code: name.toUpperCase().replace(/\s+/g, "-").slice(0, 32),
        },
      },
      update: { name },
      create: {
        schoolId,
        code: name.toUpperCase().replace(/\s+/g, "-").slice(0, 32),
        name,
      },
      select: { id: true },
    });
    jobIdByName.set(name, row.id);
    return row.id;
  };

  for (const seed of families) {
    const family = await db.family.upsert({
      where: { schoolId_code: { schoolId, code: seed.code } },
      update: {
        name: seed.name,
        nameAr: seed.nameAr,
        situation: seed.situation,
        city: seed.city,
        addressLine: seed.addressLine,
        phone: seed.phone,
      },
      create: {
        schoolId,
        code: seed.code,
        name: seed.name,
        nameAr: seed.nameAr,
        situation: seed.situation,
        city: seed.city,
        addressLine: seed.addressLine,
        phone: seed.phone,
      },
      select: { id: true },
    });

    idByCode[seed.code] = family.id;

    // The mother is the first contact when there is no father on the file —
    // exactly the rule `ensurePrimaryContact` applies in the app.
    const entries = [
      seed.father ? { relationship: "FATHER" as const, ...seed.father } : null,
      seed.mother ? { relationship: "MOTHER" as const, ...seed.mother } : null,
      seed.guardian
        ? { relationship: "GUARDIAN" as const, ...seed.guardian }
        : null,
    ].filter((entry) => entry !== null);

    for (const [index, entry] of entries.entries()) {
      const existing = await db.guardian.findFirst({
        where: { familyId: family.id, relationship: entry.relationship },
        select: { id: true },
      });

      const data = {
        firstName: entry.first,
        lastName: entry.last,
        parentJobId: await jobFor(entry.profession),
        phone: entry.phone,
        isPrimaryContact: index === 0,
        isEmergencyContact: index === 1,
      };

      if (existing) {
        await db.guardian.update({ where: { id: existing.id }, data });
      } else {
        await db.guardian.create({
          data: {
            familyId: family.id,
            relationship: entry.relationship,
            ...data,
          },
        });
      }
      guardianCount += 1;
    }
  }

  log("families", `${families.length} files, ${guardianCount} guardians`);
  return idByCode;
}
