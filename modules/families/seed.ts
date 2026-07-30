import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * Dossiers familiaux: a household, its father and mother, and the odd tuteur.
 *
 * Idempotent — upserted on `(schoolId, code)`, so re-running changes nothing and
 * a dossier added by hand survives. Guardians are upserted through a find-then-
 * write on `(familyId, relationship)`, because a father has no unique index of
 * his own (a family may have several tuteurs — see SINGULAR_RELATIONSHIPS).
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

/** Two dozen Moroccan households, enough to fill several classes with siblings. */
export const FAMILY_SEEDS: FamilySeed[] = [
  {
    code: "F-2025-0001",
    name: "Famille Bennani",
    nameAr: "أسرة بناني",
    situation: "MARRIED",
    city: "Casablanca",
    addressLine: "12, rue Ibn Batouta, Maârif",
    phone: "+212 522 25 14 08",
    father: {
      first: "Youssef",
      last: "Bennani",
      profession: "Ingénieur",
      phone: "+212 661 20 31 44",
    },
    mother: {
      first: "Nadia",
      last: "Bennani",
      profession: "Pharmacienne",
      phone: "+212 662 41 07 19",
    },
  },
  {
    code: "F-2025-0002",
    name: "Famille El Amrani",
    nameAr: "أسرة العمراني",
    situation: "MARRIED",
    city: "Casablanca",
    addressLine: "45, boulevard Zerktouni",
    phone: "+212 522 47 63 21",
    father: {
      first: "Hicham",
      last: "El Amrani",
      profession: "Commerçant",
      phone: "+212 663 55 12 90",
    },
    mother: {
      first: "Salma",
      last: "El Amrani",
      profession: "Enseignante",
      phone: "+212 664 09 88 27",
    },
  },
  {
    code: "F-2025-0003",
    name: "Famille Tazi",
    nameAr: "أسرة التازي",
    situation: "DIVORCED",
    city: "Casablanca",
    addressLine: "8, rue Al Farabi, Gauthier",
    phone: "+212 522 36 90 55",
    mother: {
      first: "Imane",
      last: "Tazi",
      profession: "Architecte",
      phone: "+212 665 73 41 02",
    },
    father: {
      first: "Reda",
      last: "Tazi",
      profession: "Consultant",
      phone: "+212 666 18 25 73",
    },
  },
  {
    code: "F-2025-0004",
    name: "Famille Ouazzani",
    nameAr: "أسرة الوزاني",
    situation: "MARRIED",
    city: "Casablanca",
    addressLine: "23, avenue Hassan II",
    phone: "+212 522 91 44 76",
    father: {
      first: "Abdelilah",
      last: "Ouazzani",
      profession: "Médecin",
      phone: "+212 667 30 55 18",
    },
    mother: {
      first: "Houda",
      last: "Ouazzani",
      profession: "Infirmière",
      phone: "+212 668 22 47 60",
    },
  },
  {
    code: "F-2025-0005",
    name: "Famille Cherkaoui",
    nameAr: "أسرة الشرقاوي",
    situation: "WIDOWED",
    city: "Casablanca",
    addressLine: "5, rue Oued Sebou, Oasis",
    phone: "+212 522 99 12 34",
    mother: {
      first: "Latifa",
      last: "Cherkaoui",
      profession: "Fonctionnaire",
      phone: "+212 669 04 66 31",
    },
    guardian: {
      first: "Mustapha",
      last: "Cherkaoui",
      profession: "Retraité",
      phone: "+212 660 51 29 84",
    },
  },
  {
    code: "F-2025-0006",
    name: "Famille Idrissi",
    nameAr: "أسرة الإدريسي",
    situation: "MARRIED",
    city: "Casablanca",
    addressLine: "17, rue Jean Jaurès",
    phone: "+212 522 27 80 15",
    father: {
      first: "Anouar",
      last: "Idrissi",
      profession: "Comptable",
      phone: "+212 661 77 30 22",
    },
    mother: {
      first: "Rajae",
      last: "Idrissi",
      profession: "Au foyer",
      phone: "+212 662 15 93 40",
    },
  },
  {
    code: "F-2025-0007",
    name: "Famille Sekkat",
    nameAr: "أسرة السقاط",
    situation: "MARRIED",
    city: "Rabat",
    addressLine: "34, avenue Fal Ould Oumeir, Agdal",
    phone: "+212 537 67 21 09",
    father: {
      first: "Nabil",
      last: "Sekkat",
      profession: "Avocat",
      phone: "+212 663 88 14 57",
    },
    mother: {
      first: "Ghita",
      last: "Sekkat",
      profession: "Journaliste",
      phone: "+212 664 62 05 38",
    },
  },
  {
    code: "F-2025-0008",
    name: "Famille Benjelloun",
    nameAr: "أسرة بنجلون",
    situation: "MARRIED",
    city: "Rabat",
    addressLine: "9, rue Tanger, Hassan",
    phone: "+212 537 72 40 63",
    father: {
      first: "Kamal",
      last: "Benjelloun",
      profession: "Banquier",
      phone: "+212 665 39 71 26",
    },
    mother: {
      first: "Souad",
      last: "Benjelloun",
      profession: "Professeure",
      phone: "+212 666 47 82 13",
    },
  },
  {
    code: "F-2025-0009",
    name: "Famille Lamrani",
    nameAr: "أسرة العمراني",
    situation: "SEPARATED",
    city: "Rabat",
    addressLine: "51, avenue Mohammed V",
    phone: "+212 537 20 96 84",
    mother: {
      first: "Karima",
      last: "Lamrani",
      profession: "Traductrice",
      phone: "+212 667 12 58 40",
    },
  },
  {
    code: "F-2025-0010",
    name: "Famille Zniber",
    nameAr: "أسرة زنيبر",
    situation: "MARRIED",
    city: "Rabat",
    addressLine: "3, rue Oukaimeden, Agdal",
    phone: "+212 537 68 33 77",
    father: {
      first: "Driss",
      last: "Zniber",
      profession: "Agriculteur",
      phone: "+212 668 90 21 65",
    },
    mother: {
      first: "Btissam",
      last: "Zniber",
      profession: "Gestionnaire",
      phone: "+212 669 35 46 08",
    },
  },
];

export async function seedFamilies(
  db: SeedDb,
  schoolId: string,
  families: FamilySeed[],
): Promise<Record<string, string>> {
  const idByCode: Record<string, string> = {};
  let guardianCount = 0;

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
        profession: entry.profession,
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
