import { defineModule } from "@/lib/module";
import { HR_PERMISSIONS } from "@/modules/hr/permissions";
import { TREASURY_PERMISSIONS } from "@/modules/treasury/permissions";

/**
 * Ressources humaines: everybody the school pays, and the three things that
 * follow from employing them — a contract, a register, a payslip.
 *
 * It owns the employment record outright and lends it to the rest of the app:
 * the fleet picks a driver from it instead of typing a name, and a décaissement
 * made out to an employee points at the row rather than repeating it. What it
 * does **not** own is the money leaving — paying a bulletin writes a
 * DECAISSEMENT in the caisse, exactly like every other payment out. This module
 * says what is owed; the ledger says what actually left.
 *
 * It also stays clear of teaching. A teacher's classes and timetable hang off
 * their `User`, because those are things an account does; the employment record
 * links to that account rather than replacing it — see the note on Staff.
 */
export const hrModule = defineModule({
  id: "hr",
  schemaFolder: "hr",
  nav: [
    {
      href: "/hr",
      icon: "hr",
      section: "rh",
      labelKey: "overview",
      order: 10,
      schoolPermission: HR_PERMISSIONS.HR_VIEW,
    },
    {
      href: "/hr/staff",
      icon: "staff",
      section: "rh",
      labelKey: "hrStaff",
      order: 20,
      schoolPermission: HR_PERMISSIONS.HR_VIEW,
    },
    {
      href: "/hr/attendance",
      icon: "attendance",
      section: "rh",
      labelKey: "hrAttendance",
      order: 30,
      // Reading the register is HR_VIEW; HR_ATTENDANCE is what lets a reader
      // actually mark it, and the screen gates the marking itself.
      schoolPermission: HR_PERMISSIONS.HR_VIEW,
    },
    {
      href: "/hr/payroll",
      icon: "payroll",
      section: "rh",
      labelKey: "hrPayroll",
      order: 40,
      // The salaries, which in most schools exactly two people may see — hence
      // its own code rather than HR_VIEW.
      schoolPermission: HR_PERMISSIONS.HR_PAYROLL,
    },
    {
      href: "/hr/advances",
      icon: "payroll",
      section: "rh",
      labelKey: "hrAdvances",
      order: 45,
      // Beside the paie and behind the same code: an avance is a movement
      // against a wage, and it is recovered on a bulletin.
      schoolPermission: HR_PERMISSIONS.HR_PAYROLL,
    },
    {
      href: "/hr/paiements",
      icon: "payroll",
      section: "rh",
      labelKey: "hrStaffPayments",
      order: 47,
      /*
        The screen needs TREASURY_DISBURSE *and* HR_VIEW, and a nav entry may
        name one code — so it names the narrower. Behind HR_VIEW the link showed
        up for every reader of the staff list and led them straight to a
        forbidden page, which is worse than not offering it.
      */
      schoolPermission: TREASURY_PERMISSIONS.TREASURY_DISBURSE,
    },
    {
      href: "/hr/leave",
      icon: "leave",
      section: "rh",
      labelKey: "hrLeave",
      order: 50,
      schoolPermission: HR_PERMISSIONS.HR_VIEW,
    },
  ],
  permissions: [{ group: "hr", codes: Object.values(HR_PERMISSIONS) }],
});
