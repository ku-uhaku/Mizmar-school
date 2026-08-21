import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { listSchoolRoles } from "@/modules/access/queries";
import {
  listCycleChoices,
  listSubjectChoices,
} from "@/modules/academics/queries";
import { HireForm } from "@/modules/hr/components/hire-form";
import { listVehicleOptions } from "@/modules/transport/queries";
import { listJobFunctionChoices } from "@/modules/users/queries";

export const metadata: Metadata = { title: "Nouvel employé" };

/**
 * Hiring somebody.
 *
 * Unlike `/students/new` this does not insist on a school year: an employee is
 * employed across years, and only the *subjects* half of the form needs one.
 * Refusing the whole page for want of a year would stop a school taking on a
 * caretaker in August, so the form says which section is unavailable instead.
 *
 * Each optional list is loaded only for a reader who may actually use it — the
 * same line the action draws, so the page can never offer a picker whose
 * submission would then be refused.
 */
export default async function NewStaffPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.HR_MANAGE)) {
    return <ForbiddenState />;
  }

  const canCreateAccount = context.can(PERMISSIONS.USER_CREATE);
  const canTeaching = context.can(PERMISSIONS.TIMETABLE_MANAGE);
  const canTransport = context.can(PERMISSIONS.TRANSPORT_MANAGE);
  // Naming who runs a cycle is an academic decision — the same authority the
  // cursus is edited under, and the one `hireStaffAction` re-asserts.
  const canOversight = context.can(PERMISSIONS.CONFIGURATION_MANAGE);

  const [schoolRoles, jobFunctions, subjects, cycles, vehicles] =
    await Promise.all([
      canCreateAccount ? listSchoolRoles(context) : Promise.resolve([]),
      canCreateAccount ? listJobFunctionChoices(context) : Promise.resolve([]),
      canTeaching ? listSubjectChoices(context) : Promise.resolve([]),
      // The one list two sections share: the qualification's cycle and the
      // cycles a directeur is answerable for.
      canTeaching || canOversight
        ? listCycleChoices(context)
        : Promise.resolve([]),
      canTransport ? listVehicleOptions(context) : Promise.resolve([]),
    ]);

  return (
    <>
      <PageHeader
        title={t.hr.newStaff}
        description={t.hr.hireSubtitle}
        backHref="/hr/staff"
        backLabel={t.hr.staff}
      />

      <HireForm
        schoolRoles={schoolRoles}
        jobFunctions={jobFunctions}
        subjects={subjects}
        cycles={cycles}
        // `seatCount` is the fleet screen's business, not this form's.
        vehicles={vehicles.map((vehicle) => ({
          id: vehicle.id,
          label: vehicle.label,
        }))}
        canPayroll={context.can(PERMISSIONS.HR_PAYROLL)}
        canCreateAccount={canCreateAccount}
        canTeaching={canTeaching}
        canTransport={canTransport}
        canOversight={canOversight}
        yearLabel={context.currentSchoolYear?.name ?? null}
      />
    </>
  );
}
