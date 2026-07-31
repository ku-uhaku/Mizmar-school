import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { TransportManager } from "@/modules/transport/components/transport-manager";
import {
  listRoutes,
  listVehicleOptions,
  listVehicles,
  listZones,
  transportSummary,
} from "@/modules/transport/queries";

export const metadata: Metadata = { title: "Transport" };

export default async function TransportPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.TRANSPORT_VIEW)) {
    return <ForbiddenState />;
  }

  const [summary, routes, vehicles, zones, vehicleOptions] = await Promise.all([
    transportSummary(context),
    listRoutes(context),
    listVehicles(context),
    listZones(context),
    listVehicleOptions(context),
  ]);

  return (
    <>
      <PageHeader title={t.transport.title} description={t.transport.subtitle} />

      <TransportManager
        summary={summary}
        routes={routes}
        vehicles={vehicles}
        zones={zones}
        vehicleOptions={vehicleOptions}
        permissions={{
          canManage: context.can(PERMISSIONS.TRANSPORT_MANAGE),
          canDelete: context.can(PERMISSIONS.TRANSPORT_DELETE),
        }}
      />
    </>
  );
}
