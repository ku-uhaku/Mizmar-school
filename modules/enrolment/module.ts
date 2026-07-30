import { defineModule } from "@/lib/module";
import { ENROLMENT_PERMISSIONS } from "@/modules/enrolment/permissions";

/**
 * Enrolment owns the year-shaped half of a pupil's record: the inscription and
 * the fee schedule it generates.
 *
 * It contributes no nav entry of its own. An enrolment is always reached
 * through the child it belongs to or the class it seats them in, and a bare
 * list of inscriptions is a screen nobody opens — the school-life dashboard is
 * where the year is looked at as a whole.
 */
export const enrolmentModule = defineModule({
  id: "enrolment",
  schemaFolder: "enrolment",
  permissions: [
    { group: "enrolment", codes: Object.values(ENROLMENT_PERMISSIONS) },
  ],
});
