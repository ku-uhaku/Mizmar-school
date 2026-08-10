/**
 * Rooms a school starts with. Year-independent, like the rest of the facilities.
 *
 * Pure data, shared by `modules/facilities/seed.ts` and the setup wizard — the
 * wizard sizes its own blocks with `classroomBlock` instead of taking the
 * demonstration's twenty-four salles whether or not the school has that many
 * classes.
 */

export type RoomPreset = {
  code: string;
  name: string;
  kind: string;
  building?: string;
  floor?: number;
  capacity?: number;
};

/**
 * A block of numbered classrooms in one building, four to a floor.
 *
 * Generated rather than listed because a room list that has to be extended by
 * hand every time a level opens another class is a list that quietly runs short,
 * and a class with no salle is the one thing `seedClasses` cannot invent.
 */
export function classroomBlock(input: {
  letter: string;
  building: string;
  capacity: number;
  count: number;
}): RoomPreset[] {
  return Array.from({ length: input.count }, (_, index) => {
    const floor = Math.floor(index / 4);
    const code = `${input.letter}${floor}${String((index % 4) + 1).padStart(2, "0")}`;
    return {
      code,
      name: `Salle ${code}`,
      kind: "CLASSROOM",
      building: input.building,
      floor,
      capacity: input.capacity,
    };
  });
}

/** Everything that is not a plain classroom: the labs, the gym, the library. */
export const SPECIALIST_ROOMS: RoomPreset[] = [
  { code: "LAB-SVT", name: "Laboratoire SVT", kind: "LAB_SCIENCE", building: "Bâtiment D", floor: 0, capacity: 24 },
  { code: "LAB-PC", name: "Laboratoire Physique-Chimie", kind: "LAB_SCIENCE", building: "Bâtiment D", floor: 0, capacity: 24 },
  { code: "INFO-1", name: "Salle informatique 1", kind: "LAB_COMPUTER", building: "Bâtiment D", floor: 1, capacity: 24 },
  { code: "INFO-2", name: "Salle informatique 2", kind: "LAB_COMPUTER", building: "Bâtiment D", floor: 1, capacity: 24 },
  { code: "GYM", name: "Salle de sport", kind: "SPORTS", building: "Annexe", capacity: 60 },
  { code: "BIB", name: "Bibliothèque", kind: "LIBRARY", building: "Bâtiment A — primaire", floor: 1, capacity: 40 },
  { code: "POLY", name: "Salle polyvalente", kind: "MULTIPURPOSE", building: "Annexe", floor: 0, capacity: 120 },
  { code: "COUR", name: "Cour de récréation", kind: "OUTDOOR", capacity: 400 },
];

/** The demonstration's three buildings of eight, plus the specialist rooms. */
const CLASSROOMS: RoomPreset[] = [
  { letter: "A", building: "Bâtiment A — primaire", capacity: 30 },
  { letter: "B", building: "Bâtiment B — collège", capacity: 36 },
  { letter: "C", building: "Bâtiment C — lycée", capacity: 36 },
].flatMap((block) => classroomBlock({ ...block, count: 8 }));

export const SCHOOL_ROOMS: RoomPreset[] = [...CLASSROOMS, ...SPECIALIST_ROOMS];
