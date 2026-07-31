import { defineModule } from "@/lib/module";
import { ASSESSMENT_PERMISSIONS } from "@/modules/assessments/permissions";

/**
 * Les contrôles: the marked work of a term, and the marks on it.
 *
 * It owns what a paper *is* — which class sat it, in which subject, under which
 * term — and every mark against it. What it deliberately does not own is what
 * those marks add up to: a subject's coefficient lives on `LevelSubject`,
 * because how much Maths weighs is a property of the level, not of any one
 * contrôle. This module says what was scored; the programme says what it counts
 * for.
 *
 * The kinds of paper are configuration, not code. `AssessmentType` is edited
 * under `/configuration`, so a school that runs three contrôles and one devoir
 * per semester needs no migration to say so.
 *
 * Attendance on the day is not here either. A pupil absent from a paper is a
 * flag on their mark, which is a fact about the paper; whether they were in
 * school that morning is a fact about the day, and belongs with the register.
 */
export const assessmentsModule = defineModule({
  id: "assessments",
  schemaFolder: "assessments",
  nav: [
    {
      href: "/assessments",
      icon: "assessments",
      section: "vieScolaire",
      labelKey: "assessments",
      // Between the classes and the week: a contrôle is set for a class and
      // sat during the term, so it reads after the cohort and before the grid.
      order: 45,
      schoolPermission: ASSESSMENT_PERMISSIONS.ASSESSMENT_VIEW,
    },
  ],
  permissions: [
    { group: "assessment", codes: Object.values(ASSESSMENT_PERMISSIONS) },
  ],
});
