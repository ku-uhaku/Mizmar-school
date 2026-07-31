import { definePermissions } from "@/lib/module";

/**
 * See modules/organization/permissions.ts for the contract.
 *
 * The split is the one a school actually makes. `HR_ATTENDANCE` is desk work —
 * somebody marks the register every morning and it tells nobody what anybody
 * earns. `HR_PAYROLL` opens the salaries, which in most schools exactly two
 * people may see. They are separate codes because granting the register should
 * never hand over the payroll.
 *
 * There is no "pay out" code here on purpose: paying a bulletin writes a
 * décaissement, so it requires `TREASURY_DISBURSE` as well — the money side
 * stays governed by the caisse's own permissions rather than by a second,
 * parallel one invented here.
 */
export const HR_PERMISSIONS = definePermissions({
  HR_VIEW: "hr.view",
  HR_MANAGE: "hr.manage",
  HR_ATTENDANCE: "hr.attendance",
  HR_PAYROLL: "hr.payroll",
  HR_DELETE: "hr.delete",
});
