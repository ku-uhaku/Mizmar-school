import { defineModule } from "@/lib/module";
import { TIMETABLE_PERMISSIONS } from "@/modules/timetable/permissions";

/**
 * The emploi du temps: the bell schedule for the year and the lesson in each
 * cell of the grid.
 *
 * Kept apart from `classes` because the two change on different rhythms — the
 * class list is settled at enrolment and rarely moves, while the timetable is
 * rewritten repeatedly and switches wholesale for Ramadan.
 *
 * The bell schedule itself is edited under `configuration`; this module owns
 * what is *in* the grid.
 */
export const timetableModule = defineModule({
  id: "timetable",
  schemaFolder: "timetable",
  nav: [
    {
      href: "/timetable",
      icon: "timetable",
      section: "vieScolaire",
      labelKey: "timetable",
      order: 50,
      schoolPermission: TIMETABLE_PERMISSIONS.TIMETABLE_VIEW,
    },
  ],
  permissions: [
    { group: "timetable", codes: Object.values(TIMETABLE_PERMISSIONS) },
  ],
});
