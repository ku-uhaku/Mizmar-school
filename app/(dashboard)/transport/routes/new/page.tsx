import type { Metadata } from "next";
import { CalendarRangeIcon } from "lucide-react";

import { EmptyState } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { listNeighbourhoodChoices } from "@/modules/geography/queries";
import { RouteWizard } from "@/modules/transport/components/route-wizard";
import {
  listScheduleOptions,
  listSubscribableStudents,
  listVehicleOptions,
} from "@/modules/transport/queries";

export const metadata: Metadata = { title: "Nouvelle ligne" };

/**
 * The line is drawn for one year — its horaires, its passengers' enrolments and
 * its code's uniqueness are all year-scoped — so the wizard needs a year in
 * context before it can ask anything.
 */
export default async function NewRoutePage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.TRANSPORT_MANAGE)) {
    return <ForbiddenState />;
  }

  if (!context.currentSchoolYear) {
    return (
      <>
        <PageHeader
          title={t.transport.wizard.title}
          backHref="/transport/routes"
          backLabel={t.transport.routes}
        />
        <div className="rounded-xl border">
          <EmptyState
            icon={<CalendarRangeIcon className="size-5" />}
            title={t.context.noYearSelected}
            description={t.errors.noSchoolYearContext}
          />
        </div>
      </>
    );
  }

  // The passenger step is only offered to whoever may give a seat; loading the
  // pupils at all is pointless otherwise.
  const canSubscribe = context.can(PERMISSIONS.TRANSPORT_SUBSCRIBE);

  // Cross-module reads through each owner's own queries — never a raw db call.
  const [vehicles, schedules, neighbourhoods, subscribable] = await Promise.all([
    listVehicleOptions(context),
    listScheduleOptions(context),
    listNeighbourhoodChoices(context),
    canSubscribe ? listSubscribableStudents(context) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title={t.transport.wizard.title}
        description={t.transport.wizard.subtitle}
        backHref="/transport/routes"
        backLabel={t.transport.routes}
      />

      <RouteWizard
        vehicles={vehicles}
        schedules={schedules}
        neighbourhoods={neighbourhoods}
        subscribable={subscribable}
        canSubscribe={canSubscribe}
      />
    </>
  );
}
