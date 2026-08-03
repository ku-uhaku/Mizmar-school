import { definePermissions } from "@/lib/module";

/**
 * See modules/organization/permissions.ts for the contract.
 *
 * One code, and it opens the *screen* — never the data. Each report carries the
 * permission of what it reports on (`HR_PAYROLL` for the salaries,
 * `TREASURY_VIEW` for the caisse), checked again in `runReport`. Without that
 * split the reporting screen would be the way round the whole permission
 * system: grant somebody "reports" and they read the payroll.
 */
export const REPORT_PERMISSIONS = definePermissions({
  REPORT_VIEW: "report.view",
});
