/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/facilities/room.prisma`. Labels belong in
 * `modules/facilities/i18n/*.ts` once this module grows a UI.
 */

/**
 * What a room is for. Drives which subjects may be timetabled into it — a
 * physics practical needs a lab, not a classroom.
 *
 *   CLASSROOM      salle de classe
 *   LAB_SCIENCE    laboratoire (SVT, physique-chimie)
 *   LAB_COMPUTER   salle informatique
 *   WORKSHOP       atelier (filières STE / STM)
 *   SPORTS         salle de sport or terrain
 *   LIBRARY        bibliothèque / centre de documentation
 *   MULTIPURPOSE   salle polyvalente, used for exams and councils
 *   OUTDOOR        cour or open ground
 */
export const ROOM_KINDS = [
  "CLASSROOM",
  "LAB_SCIENCE",
  "LAB_COMPUTER",
  "WORKSHOP",
  "SPORTS",
  "LIBRARY",
  "MULTIPURPOSE",
  "OUTDOOR",
] as const;
export type RoomKind = (typeof ROOM_KINDS)[number];

/**
 * Room kinds that satisfy `Subject.requiresLab`. A lab subject timetabled into
 * anything else is a warning, not an error — schools improvise.
 */
export const LAB_ROOM_KINDS: readonly RoomKind[] = [
  "LAB_SCIENCE",
  "LAB_COMPUTER",
  "WORKSHOP",
];
