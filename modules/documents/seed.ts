import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * The pièces a Moroccan school asks for at inscription.
 *
 * The ordinary dossier, in the order a guichet asks for it: identity first,
 * then the parents' papers, then what the previous school owes. A school edits
 * the list under Configuration — this is a starting point, not a rule.
 *
 * Idempotent: upserted on `(schoolId, code)`, and never deleted — a pièce a
 * school stopped asking for stays withdrawn through a re-seed.
 */

export type DocumentTypeSeed = {
  code: string;
  name: string;
  nameAr: string;
  isRequired: boolean;
  copies?: number;
  notes?: string;
};

export const DOCUMENT_TYPE_SEEDS: DocumentTypeSeed[] = [
  {
    code: "ACTE-NAISSANCE",
    name: "Copie de l'acte de naissance",
    nameAr: "نسخة من عقد الازدياد",
    isRequired: true,
    notes: "De moins de trois mois",
  },
  {
    code: "PHOTOS",
    name: "Photos d'identité",
    nameAr: "صور شمسية",
    isRequired: true,
    copies: 4,
    notes: "Récentes, fond clair",
  },
  {
    code: "CIN-PERE",
    name: "Copie de la CIN du père",
    nameAr: "نسخة من البطاقة الوطنية للأب",
    isRequired: true,
  },
  {
    code: "CIN-MERE",
    name: "Copie de la CIN de la mère",
    nameAr: "نسخة من البطاقة الوطنية للأم",
    isRequired: true,
  },
  {
    code: "CIN-TUTEUR",
    name: "Copie de la CIN du tuteur",
    nameAr: "نسخة من البطاقة الوطنية للوصي",
    // Only where there is one, which is exactly what optional is for.
    isRequired: false,
    notes: "Lorsque l'enfant n'est pas sous la garde de ses parents",
  },
  {
    code: "LIVRET-FAMILLE",
    name: "Copie du livret de famille",
    nameAr: "نسخة من دفتر الحالة المدنية",
    isRequired: true,
  },
  {
    code: "CERTIF-SCOLARITE",
    name: "Certificat de scolarité",
    nameAr: "شهادة مدرسية",
    isRequired: false,
    notes: "Pour un élève venant d'un autre établissement",
  },
  {
    code: "CERTIF-TRANSFERT",
    name: "Certificat de transfert",
    nameAr: "شهادة المغادرة",
    isRequired: false,
    notes: "Délivré par l'établissement d'origine",
  },
  {
    code: "BULLETIN-PRECEDENT",
    name: "Bulletin de l'année précédente",
    nameAr: "بيان النقط للسنة الماضية",
    isRequired: false,
  },
  {
    code: "FICHE-MEDICALE",
    name: "Fiche médicale",
    nameAr: "البطاقة الطبية",
    isRequired: true,
    notes: "Remplie et signée par le médecin de famille",
  },
  {
    code: "CARNET-VACCINATION",
    name: "Copie du carnet de vaccination",
    nameAr: "نسخة من دفتر التلقيح",
    isRequired: false,
  },
  {
    code: "ATTESTATION-TRAVAIL",
    name: "Attestation de travail des parents",
    nameAr: "شهادة عمل الوالدين",
    isRequired: false,
  },
  {
    code: "FICHE-INSCRIPTION",
    name: "Fiche d'inscription signée",
    nameAr: "مطبوع التسجيل موقّع",
    isRequired: true,
  },
];

export async function seedDocumentTypes(
  db: SeedDb,
  schoolId: string,
): Promise<number> {
  for (const [index, seed] of DOCUMENT_TYPE_SEEDS.entries()) {
    const data = {
      name: seed.name,
      nameAr: seed.nameAr,
      isRequired: seed.isRequired,
      copies: seed.copies ?? null,
      notes: seed.notes ?? null,
      position: index,
    };

    await db.documentType.upsert({
      where: { schoolId_code: { schoolId, code: seed.code } },
      // `isActive` is deliberately absent from the update: a pièce the school
      // stopped asking for must stay withdrawn through a re-seed.
      update: data,
      create: { schoolId, code: seed.code, ...data },
    });
  }

  log("dossier documents", `${DOCUMENT_TYPE_SEEDS.length} pièces`);
  return DOCUMENT_TYPE_SEEDS.length;
}
