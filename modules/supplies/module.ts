import { defineModule } from "@/lib/module";
import { SUPPLY_PERMISSIONS } from "@/modules/supplies/permissions";

/**
 * Listes de fournitures: what each class is asked to bring, and who agreed to
 * ask for it.
 *
 * Its own module rather than a corner of `classroom`, because the list is not
 * something that happens in the room — it is written by a teacher, decided by
 * the office and read by a family, and those three are the whole of it. The
 * approval step is the reason it exists at all; a table of items with no
 * decision attached would just be a note.
 */
export const suppliesModule = defineModule({
  id: "supplies",
  schemaFolder: "supplies",
  nav: [
    {
      href: "/supplies",
      icon: "supplies",
      section: "vieScolaire",
      labelKey: "supplies",
      order: 60,
      schoolPermission: SUPPLY_PERMISSIONS.SUPPLY_VIEW,
    },
  ],
  permissions: [{ group: "supply", codes: Object.values(SUPPLY_PERMISSIONS) }],
});
