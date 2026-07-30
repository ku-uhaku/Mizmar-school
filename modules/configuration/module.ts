import { defineModule } from "@/lib/module";
import { CONFIGURATION_PERMISSIONS } from "@/modules/configuration/permissions";

/**
 * The configuration section: one screen per configurable table, generated from
 * the descriptors in `resources.ts`.
 *
 * It owns no tables of its own — it edits those of `academics`, `facilities`,
 * `classes`, `timetable`, `school-years` and `billing`. That is deliberate: the
 * tables belong with the domain that gives them meaning, and this module is only
 * the editing surface.
 */
export const configurationModule = defineModule({
  id: "configuration",
  nav: [
    {
      href: "/configuration",
      icon: "configuration",
      section: "administration",
      labelKey: "configuration",
      order: 40,
      // School-scoped: a director configures their own school, so a
      // school-level grant is enough and the working context does the confining.
      schoolPermission: CONFIGURATION_PERMISSIONS.CONFIGURATION_VIEW,
    },
  ],
  permissions: [
    {
      group: "configuration",
      codes: Object.values(CONFIGURATION_PERMISSIONS),
    },
  ],
});
