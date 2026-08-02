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

/**
 * One salle per class, plus the specialist rooms.
 *
 * Three buildings of eight — A for the primaire, B for the collège, C for the
 * lycée — which is enough for the twenty-four classes a school opens and is why
 * they are generated rather than listed: a room list that has to be extended by
 * hand every time a level opens another class is a list that quietly runs short,
 * and a class with no salle is the one thing `seedClasses` cannot invent.
 */
const CLASSROOMS: RoomSeed[] = [
  { letter: "A", building: "Bâtiment A — primaire", capacity: 30 },
  { letter: "B", building: "Bâtiment B — collège", capacity: 36 },
  { letter: "C", building: "Bâtiment C — lycée", capacity: 36 },
].flatMap(({ letter, building, capacity }) =>
  Array.from({ length: 8 }, (_, index) => {
    const floor = Math.floor(index / 4);
    const code = `${letter}${floor}${String((index % 4) + 1).padStart(2, "0")}`;
    return {
      code,
      name: `Salle ${code}`,
      kind: "CLASSROOM",
      building,
      floor,
      capacity,
    };
  }),
);

export const SCHOOL_ROOMS: RoomSeed[] = [
  ...CLASSROOMS,
  { code: "LAB-SVT", name: "Laboratoire SVT", kind: "LAB_SCIENCE", building: "Bâtiment D", floor: 0, capacity: 24 },
  { code: "LAB-PC", name: "Laboratoire Physique-Chimie", kind: "LAB_SCIENCE", building: "Bâtiment D", floor: 0, capacity: 24 },
  { code: "INFO-1", name: "Salle informatique 1", kind: "LAB_COMPUTER", building: "Bâtiment D", floor: 1, capacity: 24 },
  { code: "INFO-2", name: "Salle informatique 2", kind: "LAB_COMPUTER", building: "Bâtiment D", floor: 1, capacity: 24 },
  { code: "GYM", name: "Salle de sport", kind: "SPORTS", building: "Annexe", capacity: 60 },
  { code: "BIB", name: "Bibliothèque", kind: "LIBRARY", building: "Bâtiment A — primaire", floor: 1, capacity: 40 },
  { code: "POLY", name: "Salle polyvalente", kind: "MULTIPURPOSE", building: "Annexe", floor: 0, capacity: 120 },
  { code: "COUR", name: "Cour de récréation", kind: "OUTDOOR", capacity: 400 },
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
