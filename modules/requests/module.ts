import { defineModule } from "@/lib/module";
import { REQUEST_PERMISSIONS } from "@/modules/requests/permissions";

/**
 * Les demandes de documents: a family asking the school for a paper, and the
 * office's answer.
 *
 * ── Why it is not part of `documents` ───────────────────────────────────────
 * That module is the dossier d'inscription — the pièces a family brings *to*
 * the school. This is the opposite direction: what the school writes *for* the
 * family. Different catalogue, different desk, different workflow, and no row
 * belongs on both lists.
 *
 * It owns the request and lends it to the portal: the phone files one and reads
 * its own through `modules/portal/queries.ts`, scoped on the household, and
 * never touches this module's tables directly. That is the same arrangement
 * `events` and `chat` have, and for the same reason — a parent holds no
 * membership and no permission, so nothing here may be reached by the staff
 * scoping every other module uses.
 */
export const requestsModule = defineModule({
  id: "requests",
  schemaFolder: "requests",
  nav: [
    {
      href: "/requests",
      icon: "requests",
      section: "vieScolaire",
      labelKey: "requests",
      // Just after the announcements: both are the school's correspondence with
      // its families, one outward and one in.
      order: 62,
      schoolPermission: REQUEST_PERMISSIONS.REQUEST_VIEW,
    },
  ],
  permissions: [
    { group: "request", codes: Object.values(REQUEST_PERMISSIONS) },
  ],
});
