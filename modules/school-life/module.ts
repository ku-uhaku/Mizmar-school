import { defineModule } from "@/lib/module";
import { SCHOOL_LIFE_PERMISSIONS } from "@/modules/school-life/permissions";

/**
 * La vie scolaire: the year seen whole.
 *
 * Owns no tables and no schema folder. It composes what families, students,
 * enrolment and classes already know how to count, and it hosts the header
 * search — the two places in the app where the question is about the school
 * rather than about one row in it.
 */
export const schoolLifeModule = defineModule({
  id: "school-life",
  nav: [
    {
      href: "/school-life",
      icon: "schoolLife",
      section: "main",
      labelKey: "schoolLife",
      order: 15,
      schoolPermission: SCHOOL_LIFE_PERMISSIONS.SCHOOL_LIFE_VIEW,
    },
  ],
  permissions: [
    { group: "schoolLife", codes: Object.values(SCHOOL_LIFE_PERMISSIONS) },
  ],
});
