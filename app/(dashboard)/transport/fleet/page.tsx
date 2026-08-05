import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { FleetList } from "@/modules/transport/components/fleet-list";
import { listDriverOptions } from "@/modules/hr/queries";
import { listVehicles } from "@/modules/transport/queries";

export const metadata: Metadata = { title: "Flotte" };

export default async function TransportFleetPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.TRANSPORT_VIEW)) {
    return <ForbiddenState />;
  }

  const [vehicles, crewOptions] = await Promise.all([
    listVehicles(context),
    // The bus's crew — driver and accompagnateur — picked from one list, since
    // both are employees of this school. Only offered to readers who may see
    // the staff list; the form keeps its free-text fields for everybody else.
    context.can(PERMISSIONS.HR_VIEW)
      ? listDriverOptions(context)
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title={t.transport.fleet}
        description={t.transport.fleetHint}
        backHref="/transport"
        backLabel={t.transport.title}
      />

      <FleetList
        vehicles={vehicles}
        crewOptions={crewOptions}
        permissions={{
          canManage: context.can(PERMISSIONS.TRANSPORT_MANAGE),
          canDelete: context.can(PERMISSIONS.TRANSPORT_DELETE),
        }}
      />
    </>
  );
}
