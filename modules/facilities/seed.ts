import { log, type SeedDb } from "@/prisma/seed/client";

/** Rooms for one school. Year-independent, like the rest of the facilities. */

export type RoomSeed = {
  code: string;
  name: string;
  kind: string;
  building?: string;
  floor?: number;
  capacity?: number;
};

export const FULL_RANGE_ROOMS: RoomSeed[] = [
  { code: "A01", name: "Salle A01", kind: "CLASSROOM", building: "Bâtiment A", floor: 0, capacity: 36 },
  { code: "A02", name: "Salle A02", kind: "CLASSROOM", building: "Bâtiment A", floor: 0, capacity: 36 },
  { code: "A11", name: "Salle A11", kind: "CLASSROOM", building: "Bâtiment A", floor: 1, capacity: 40 },
  { code: "A12", name: "Salle A12", kind: "CLASSROOM", building: "Bâtiment A", floor: 1, capacity: 40 },
  { code: "B01", name: "Salle B01", kind: "CLASSROOM", building: "Bâtiment B", floor: 0, capacity: 32 },
  { code: "B02", name: "Salle B02", kind: "CLASSROOM", building: "Bâtiment B", floor: 0, capacity: 32 },
  { code: "B11", name: "Salle B11", kind: "CLASSROOM", building: "Bâtiment B", floor: 1, capacity: 34 },
  { code: "B12", name: "Salle B12", kind: "CLASSROOM", building: "Bâtiment B", floor: 1, capacity: 34 },
  { code: "LAB-SVT", name: "Laboratoire SVT", kind: "LAB_SCIENCE", building: "Bâtiment C", floor: 0, capacity: 18 },
  { code: "LAB-PC", name: "Laboratoire Physique-Chimie", kind: "LAB_SCIENCE", building: "Bâtiment C", floor: 0, capacity: 18 },
  { code: "INFO-1", name: "Salle informatique", kind: "LAB_COMPUTER", building: "Bâtiment C", floor: 1, capacity: 24 },
  { code: "GYM", name: "Salle de sport", kind: "SPORTS", building: "Annexe", capacity: 60 },
  { code: "BIB", name: "Bibliothèque", kind: "LIBRARY", building: "Bâtiment A", floor: 1, capacity: 40 },
  { code: "POLY", name: "Salle polyvalente", kind: "MULTIPURPOSE", building: "Bâtiment A", floor: 0, capacity: 120 },
];

export const PRIMARY_ONLY_ROOMS: RoomSeed[] = [
  { code: "P01", name: "Salle P01", kind: "CLASSROOM", building: "Bâtiment principal", floor: 0, capacity: 28 },
  { code: "P02", name: "Salle P02", kind: "CLASSROOM", building: "Bâtiment principal", floor: 0, capacity: 28 },
  { code: "P03", name: "Salle P03", kind: "CLASSROOM", building: "Bâtiment principal", floor: 0, capacity: 28 },
  { code: "P11", name: "Salle P11", kind: "CLASSROOM", building: "Bâtiment principal", floor: 1, capacity: 30 },
  { code: "P12", name: "Salle P12", kind: "CLASSROOM", building: "Bâtiment principal", floor: 1, capacity: 30 },
  { code: "PRE-1", name: "Classe préscolaire 1", kind: "CLASSROOM", building: "Annexe", floor: 0, capacity: 20 },
  { code: "PRE-2", name: "Classe préscolaire 2", kind: "CLASSROOM", building: "Annexe", floor: 0, capacity: 20 },
  { code: "SALLE-ACT", name: "Salle d'activités", kind: "MULTIPURPOSE", building: "Annexe", floor: 0, capacity: 40 },
  { code: "COUR", name: "Cour de récréation", kind: "OUTDOOR", capacity: 200 },
];

export async function seedRooms(
  db: SeedDb,
  schoolId: string,
  rooms: RoomSeed[],
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
