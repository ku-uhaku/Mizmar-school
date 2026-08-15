import { REQUEST_TYPE_SEEDS } from "@/modules/requests/presets";
import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * The catalogue written for one school. The list itself is presets.ts.
 *
 * Idempotent: upserts on `(schoolId, code)`.
 */

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
