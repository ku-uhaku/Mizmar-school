import type { RoomPreset } from "@/modules/facilities/presets";
import { log, type SeedDb } from "@/prisma/seed/client";

/** Writes one school's rooms. The catalogue lives in `presets.ts`. */

export async function seedRooms(
  db: SeedDb,
  schoolId: string,
  rooms: RoomPreset[],
): Promise<Record<string, string>> {
  const idByCode: Record<string, string> = {};

  for (const room of rooms) {
    const row = await db.room.upsert({
      where: { schoolId_code: { schoolId, code: room.code } },
      update: {
        name: room.name,
        kind: room.kind,
        building: room.building ?? null,
        floor: room.floor ?? null,
        capacity: room.capacity ?? null,
      },
      create: {
        schoolId,
        code: room.code,
        name: room.name,
        kind: room.kind,
        building: room.building ?? null,
        floor: room.floor ?? null,
        capacity: room.capacity ?? null,
      },
    });
    idByCode[room.code] = row.id;
  }

  log("rooms", rooms.length);
  return idByCode;
}
