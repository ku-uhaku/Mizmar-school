import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { listNeighbourhoodChoices } from "@/modules/geography/queries";
import { RoutePanel } from "@/modules/transport/components/route-panel";
import {
  findRoute,
  listSubscribableStudents,
  listZones,
} from "@/modules/transport/queries";

export const metadata: Metadata = { title: "Ligne" };

export default async function RoutePage({
  params,
}: {
  params: Promise<{ routeId: string }>;
}) {
  const { routeId } = await params;
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.TRANSPORT_VIEW)) {
    return <ForbiddenState />;
  }

  // Scoped to the year in context; a line from another year or school reads as
  // absent rather than forbidden, so its existence cannot be probed.
  const route = await findRoute(context, routeId);
  if (!route) notFound();

  const [zones, neighbourhoods, subscribable] = await Promise.all([
    listZones(context),
    listNeighbourhoodChoices(context),
    listSubscribableStudents(context),
  ]);

  return (
    <>
      <PageHeader
        title={`${route.code} · ${route.name}`}
        description={route.notes ?? undefined}
        backHref="/transport/routes"
        backLabel={t.transport.routes}
      >
        {route.isActive ? null : <Badge variant="outline">{t.common.inactive}</Badge>}
      </PageHeader>

      <RoutePanel
        route={route}
        zones={zones}
        neighbourhoods={neighbourhoods}
        subscribable={subscribable}
        permissions={{
          canManage: context.can(PERMISSIONS.TRANSPORT_MANAGE),
          canSubscribe: context.can(PERMISSIONS.TRANSPORT_SUBSCRIBE),
        }}
      />
    </>
  );
}
