import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { TransportDashboard } from "@/modules/transport/components/transport-dashboard";
import {
  listRoutes,
  listVehicles,
  listZones,
  transportSummary,
} from "@/modules/transport/queries";

export const metadata: Metadata = { title: "Logistique" };

/**
 * The logistics overview: how full the lines run, and which buses are about to
 * lose their papers. The lines, the fleet and the zones are edited on their own
 * screens — this one only says where to look first.
 */
export default async function TransportPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.TRANSPORT_VIEW)) {
    return <ForbiddenState />;
  }

  const canManageZones = context.can(PERMISSIONS.TRANSPORT_MANAGE);

  const [summary, routes, vehicles, zones] = await Promise.all([
    transportSummary(context),
    listRoutes(context),
    listVehicles(context),
    // Zones are pricing, not operations: a reader who may not touch them is not
    // shown a card counting them.
    canManageZones ? listZones(context) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title={t.transport.title} description={t.transport.subtitle} />

      <TransportDashboard
        summary={summary}
        routes={routes}
        vehicles={vehicles}
        zoneCount={zones.length}
        canManageZones={canManageZones}
      />
    </>
  );
}
