import { defineModule } from "@/lib/module";

/**
 * The emploi du temps: the bell schedule for the year and the lesson in each
 * cell of the grid.
 *
 * Kept apart from `classes` because the two change on different rhythms — the
 * class list is settled at enrolment and rarely moves, while the timetable is
 * rewritten repeatedly and switches wholesale for Ramadan.
 *
 * No nav or permissions yet — tables only.
 */
export const timetableModule = defineModule({
  id: "timetable",
  schemaFolder: "timetable",
});
