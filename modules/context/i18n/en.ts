/**
 * Working context translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const en = {
  context: {
    school: "School",
    schoolYear: "School year",
    switchSchool: "Switch school",
    switchSchoolYear: "Switch school year",
    noSchoolSelected: "No school selected",
    noYearSelected: "No year selected",
    noSchoolsAvailable: "No schools available",
    noYearsAvailable: "No school years for this school yet",
    switched: "Context updated.",
    workingContext: "Working context",
  },
} as const;

export default en;
