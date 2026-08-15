import { DOCUMENT_TYPE_SEEDS } from "@/modules/documents/presets";
import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * The dossier written for one school. The list itself is presets.ts.
 *
 * Idempotent: upserted on `(schoolId, code)`, and never deleted — a pièce a
 * school stopped asking for stays withdrawn through a re-seed.
 */

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
