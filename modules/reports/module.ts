import { defineModule } from "@/lib/module";
import { REPORT_PERMISSIONS } from "@/modules/reports/permissions";

/**
 * Les rapports: every other module's data, between two dates and through a
 * filter, as a table somebody can print or export.
 *
 * It owns no figures of its own — that is the point. A report is a *reading* of
 * somebody else's rows, so this module declares what can be asked and how to
 * ask it, and every figure still comes from the module that owns it. Its one
 * table holds no data about the school at all: `ReportFavourite` is which
 * reports a given person has starred.
 */
export const reportsModule = defineModule({
  id: "reports",
  schemaFolder: "reports",
  nav: [
    {
      href: "/reports",
      icon: "reports",
      section: "administration",
      labelKey: "reports",
      order: 15,
      schoolPermission: REPORT_PERMISSIONS.REPORT_VIEW,
    },
  ],
  permissions: [
    { group: "report", codes: Object.values(REPORT_PERMISSIONS) },
  ],
});
