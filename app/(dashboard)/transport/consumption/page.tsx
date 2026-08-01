import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { listDriverOptions } from "@/modules/hr/queries";
import { listOperationCategories } from "@/modules/treasury/queries";
import { FuelList } from "@/modules/transport/components/fuel-list";
import {
  fuelSummary,
  listFuelRequests,
  listFuelVehicleOptions,
} from "@/modules/transport/queries";

export const metadata: Metadata = { title: "Consommation" };

/**
 * Les demandes de consommation.
 *
 * Thin as every route is: authorize, compose each module's own read, render.
 * The rubriques come from the caisse's own query because approving a request
 * posts a décaissement under one, and there is no second list of them.
 */
export default async function TransportConsumptionPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  // TRANSPORT_FUEL, not TRANSPORT_VIEW: the screen is the driver's, and reading
  // what the fleet spends is a narrower thing than reading the lines.
  if (!context.can(PERMISSIONS.TRANSPORT_FUEL)) {
    return <ForbiddenState />;
  }

  const [requests, summary, vehicles, drivers, categories] = await Promise.all([
    listFuelRequests(context),
    fuelSummary(context),
    listFuelVehicleOptions(context),
    listDriverOptions(context),
    listOperationCategories(context, "OUT"),
  ]);

  return (
    <>
      <PageHeader
        title={t.transport.fuelTitle}
        description={t.transport.fuelSubtitle}
        backHref="/transport"
        backLabel={t.transport.title}
      />

      <FuelList
        requests={requests}
        summary={summary}
        vehicles={vehicles}
        drivers={drivers.map((driver) => ({
          id: driver.id,
          label: driver.label,
        }))}
        categories={categories.map((category) => ({
          id: category.id,
          label: category.name,
        }))}
        permissions={{
          canRaise: context.can(PERMISSIONS.TRANSPORT_FUEL),
          canApprove: context.can(PERMISSIONS.TRANSPORT_FUEL_APPROVE),
        }}
      />
    </>
  );
}
