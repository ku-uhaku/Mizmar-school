import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * The papers a Moroccan school is asked for.
 *
 * Only the *catalogue* is seeded, never a request: a request is a family
 * asking, and inventing one would put work in a queue nobody asked for. The
 * demo fills the queue through the phone, which is also the shortest way to see
 * the workflow run.
 *
 * Idempotent: upserts on `(schoolId, code)`.
 */

export type RequestTypeSeed = {
  code: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  usualDelayDays: number | null;
  requiresReason: boolean;
  position: number;
};

export const REQUEST_TYPE_SEEDS: RequestTypeSeed[] = [
  {
    code: "ATTEST-SCO",
    name: "Attestation de scolarité",
    nameAr: "شهادة مدرسية",
    description:
      "Atteste que l'élève est inscrit et suit sa scolarité cette année.",
    descriptionAr: "تثبت أن التلميذ مسجل ويتابع دراسته هذه السنة.",
    // The one a secretary writes while the parent waits.
    usualDelayDays: 1,
    requiresReason: false,
    position: 1,
  },
  {
    code: "CERT-SCO",
    name: "Certificat de scolarité",
    nameAr: "شهادة الدراسة",
    description:
      "Document officiel signé par la direction, pour une administration ou un employeur.",
    descriptionAr: "وثيقة رسمية موقعة من الإدارة، لجهة إدارية أو لمشغّل.",
    // Needs the director's signature, so it is not a same-day paper.
    usualDelayDays: 3,
    requiresReason: false,
    position: 2,
  },
  {
    code: "RELEVE-NOTES",
    name: "Relevé de notes",
    nameAr: "بيان النقط",
    description: "Les notes de l'élève pour une période donnée.",
    descriptionAr: "نقط التلميذ خلال فترة محددة.",
    usualDelayDays: 3,
    requiresReason: false,
    position: 3,
  },
  {
    code: "ATTEST-PAIEMENT",
    name: "Attestation de paiement",
    nameAr: "شهادة الأداء",
    description: "Récapitulatif des frais réglés, pour un employeur ou un impôt.",
    descriptionAr: "بيان بالمبالغ المؤداة، لمشغّل أو لمصلحة الضرائب.",
    usualDelayDays: 2,
    requiresReason: false,
    position: 4,
  },
  {
    code: "CERT-RADIATION",
    name: "Certificat de radiation",
    nameAr: "شهادة المغادرة",
    description:
      "Nécessaire pour inscrire l'élève dans un autre établissement.",
    descriptionAr: "ضرورية لتسجيل التلميذ في مؤسسة أخرى.",
    usualDelayDays: 5,
    // A school will not write one without knowing why: it is the paper that
    // ends an inscription, and the office rings the family first.
    requiresReason: true,
    position: 5,
  },
  {
    code: "AUTRE",
    name: "Autre demande",
    nameAr: "طلب آخر",
    description: "Décrivez ce dont vous avez besoin.",
    descriptionAr: "صف ما تحتاج إليه.",
    // No promise: the office cannot know how long something it has not read
    // will take.
    usualDelayDays: null,
    // The whole content of the request is the reason, so it cannot be blank.
    requiresReason: true,
    position: 99,
  },
];

export async function seedRequestTypes(
  db: SeedDb,
  schoolId: string,
): Promise<Map<string, string>> {
  const idByCode = new Map<string, string>();

  for (const seed of REQUEST_TYPE_SEEDS) {
    const type = await db.documentRequestType.upsert({
      where: { schoolId_code: { schoolId, code: seed.code } },
      update: {
        name: seed.name,
        nameAr: seed.nameAr,
        description: seed.description,
        descriptionAr: seed.descriptionAr,
        usualDelayDays: seed.usualDelayDays,
        requiresReason: seed.requiresReason,
        position: seed.position,
      },
      create: {
        schoolId,
        code: seed.code,
        name: seed.name,
        nameAr: seed.nameAr,
        description: seed.description,
        descriptionAr: seed.descriptionAr,
        usualDelayDays: seed.usualDelayDays,
        requiresReason: seed.requiresReason,
        position: seed.position,
      },
      select: { id: true },
    });
    idByCode.set(seed.code, type.id);
  }

  log("document request types", idByCode.size);
  return idByCode;
}
