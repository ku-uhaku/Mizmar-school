import { defineModule } from "@/lib/module";
import { CLASS_PERMISSIONS } from "@/modules/classes/permissions";

/**
 * The cohorts of one school year: which levels the school opened, the classes
 * inside them, the groups a class splits into, and which teacher is answerable
 * for which subject.
 *
 * This is the module that turns the curriculum into a running year, so
 * everything it owns hangs off `SchoolYear` rather than `School`.
 *
 * Creating the classes themselves stays in `configuration`; this module's
 * screens are for running the ones that exist.
 */
export const classesModule = defineModule({
  id: "classes",
  schemaFolder: "classes",
  nav: [
    {
      href: "/classes",
      icon: "classes",
      section: "vieScolaire",
      labelKey: "classes",
      order: 40,
      schoolPermission: CLASS_PERMISSIONS.CLASS_VIEW,
    },
  ],
  permissions: [{ group: "class", codes: Object.values(CLASS_PERMISSIONS) }],
});
