import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { ZoneList } from "@/modules/transport/components/zone-list";
import { listZones } from "@/modules/transport/queries";

export const metadata: Metadata = { title: "Zones" };

/**
 * A zone's rate is what a rider's family is charged, so reading the line list is
 * not enough to open this screen — it is gated on TRANSPORT_MANAGE.
 */
export default async function TransportZonesPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.TRANSPORT_MANAGE)) {
    return <ForbiddenState />;
  }

  const zones = await listZones(context);

  return (
    <>
      <PageHeader
        title={t.transport.zones}
        description={t.transport.zonesHint}
        backHref="/transport"
        backLabel={t.transport.title}
      />

      <ZoneList zones={zones} canManage />
    </>
  );
}
