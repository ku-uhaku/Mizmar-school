import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { RouteList } from "@/modules/transport/components/route-list";
import { listRoutes, listVehicleOptions } from "@/modules/transport/queries";

export const metadata: Metadata = { title: "Lignes" };

export default async function TransportRoutesPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.TRANSPORT_VIEW)) {
    return <ForbiddenState />;
  }

  const [routes, vehicleOptions] = await Promise.all([
    listRoutes(context),
    listVehicleOptions(context),
  ]);

  return (
    <>
      <PageHeader
        title={t.transport.routes}
        description={t.transport.routesHint}
        backHref="/transport"
        backLabel={t.transport.title}
      />

      <RouteList
        routes={routes}
        vehicleOptions={vehicleOptions}
        permissions={{
          canManage: context.can(PERMISSIONS.TRANSPORT_MANAGE),
          canDelete: context.can(PERMISSIONS.TRANSPORT_DELETE),
        }}
      />
    </>
  );
}
