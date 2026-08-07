"use client";

import {
  BusIcon,
  RouteIcon,
  TriangleAlertIcon,
  UsersIcon,
  ArmchairIcon,
} from "lucide-react";

import { Meter } from "@/components/charts/meter";
import { StatTile } from "@/components/charts/stat-tile";
import { EmptyState } from "@/components/shell/empty-state";
import {
  SectionLinks,
  type SectionLink,
} from "@/components/shell/section-links";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate, interpolate } from "@/lib/i18n/format";
import { expiryState } from "@/modules/transport/enums";
import type {
  RouteRow,
  TransportSummary,
  VehicleRow,
} from "@/modules/transport/queries";
import { SectionHeading } from "@/components/shell/section-heading";

/**
 * The logistics section, seen whole.
 *
 * It answers the two questions that decide whether the buses run tomorrow: is
 * there a seat for everybody, and is there a bus whose papers have lapsed. Both
 * are read off rows the sub-screens already own, so the dashboard composes
 * rather than querying anything of its own.
 */
export function TransportDashboard({
  summary,
  routes,
  vehicles,
}: {
  summary: TransportSummary;
  routes: RouteRow[];
  vehicles: VehicleRow[];
}) {
  const t = useT();
  const locale = useLocale();

  // A bus is only a worry while it is meant to be carrying children.
  const expiring = vehicles
    .filter((vehicle) => vehicle.status !== "RETIRED")
    .map((vehicle) => ({
      vehicle,
      insurance: expiryState(vehicle.insuranceExpiresOn),
      inspection: expiryState(vehicle.inspectionExpiresOn),
    }))
    .filter((entry) => entry.insurance !== "OK" || entry.inspection !== "OK");

  const links: SectionLink[] = [
    {
      href: "/transport/routes",
      label: t.nav.transportRoutes,
      description: t.transport.routesHint,
      icon: <RouteIcon className="size-4" />,
      badge: String(routes.length),
    },
    {
      href: "/transport/fleet",
      label: t.nav.transportFleet,
      description: t.transport.fleetHint,
      icon: <BusIcon className="size-4" />,
      badge:
        summary.paperworkDue > 0
          ? interpolate(t.transport.paperworkCount, {
              count: summary.paperworkDue,
            })
          : String(vehicles.length),
      badgeTone: summary.paperworkDue > 0 ? "warn" : undefined,
    },
  ];

  return (
    <div className="grid gap-5">
      {/* The main dashboard's three bands, in its order. */}
      <section className="grid gap-3">
        <SectionHeading label={t.bands.overview} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={t.transport.linesRunning}
            value={summary.routeCount}
            detail={interpolate(t.transport.stopsAcrossLines, {
              count: routes.reduce(
                (total, route) => total + route.stopCount,
                0,
              ),
            })}
            icon={<RouteIcon className="size-4" />}
            locale={locale}
            href="/transport/routes"
          />
          <StatTile
            label={t.transport.ridersTotal}
            value={summary.riderCount}
            detail={interpolate(t.transport.ofSeatsOffered, {
              count: summary.seatsOffered,
            })}
            icon={<UsersIcon className="size-4" />}
            locale={locale}
          />
          <StatTile
            label={t.transport.seatsFree}
            value={summary.seatsRemaining}
            detail={t.transport.seatsFreeHint}
            icon={<ArmchairIcon className="size-4" />}
            locale={locale}
          />
          <StatTile
            label={t.transport.paperworkDue}
            value={summary.paperworkDue}
            detail={interpolate(t.transport.busesInService, {
              count: summary.activeVehicleCount,
            })}
            icon={<TriangleAlertIcon className="size-4" />}
            locale={locale}
            href="/transport/fleet"
          />
        </div>
      </section>

      <section className="grid gap-3">
        <SectionHeading label={t.bands.goTo} />
        <SectionLinks links={links} />
      </section>

      <section className="grid gap-3">
        <SectionHeading label={t.bands.insights} />
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="gap-4 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">
                {t.transport.occupancy}
              </CardTitle>
              <CardDescription>{t.transport.occupancyHint}</CardDescription>
            </CardHeader>
            <CardContent>
              {routes.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  {t.transport.noRoutes}
                </p>
              ) : (
                <div className="space-y-4">
                  {routes.slice(0, 8).map((route) => (
                    <Meter
                      key={route.id}
                      // A line with no bus offers no seats; drawing it as full
                      // would read as the opposite of the problem it has.
                      value={
                        route.seats > 0
                          ? Math.min(
                              100,
                              Math.round((route.taken / route.seats) * 100),
                            )
                          : 0
                      }
                      label={`${route.code} · ${route.name}`}
                      caption={
                        route.seats > 0
                          ? interpolate(t.transport.seatsTaken, {
                              taken: route.taken,
                              seats: route.seats,
                            })
                          : t.transport.noVehicleAssigned
                      }
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="gap-4">
            <CardHeader>
              <CardTitle className="text-base">
                {t.transport.paperworkDue}
              </CardTitle>
              <CardDescription>{t.transport.paperworkHint}</CardDescription>
            </CardHeader>
            <CardContent>
              {expiring.length === 0 ? (
                <EmptyState title={t.transport.allPapersValid} />
              ) : (
                <ul className="divide-y">
                  {expiring
                    .slice(0, 6)
                    .map(({ vehicle, insurance, inspection }) => (
                      <li
                        key={vehicle.id}
                        className="py-2.5 first:pt-0 last:pb-0"
                      >
                        <p className="text-sm font-medium">
                          {vehicle.registration}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {insurance !== "OK" ? (
                            <ExpiryBadge
                              state={insurance}
                              label={t.transport.insurance}
                              date={vehicle.insuranceExpiresOn}
                              expiredLabel={t.transport.expired}
                              soonLabel={t.transport.expiringSoon}
                              missingLabel={t.transport.noExpiryRecorded}
                              locale={locale}
                            />
                          ) : null}
                          {inspection !== "OK" ? (
                            <ExpiryBadge
                              state={inspection}
                              label={t.transport.inspection}
                              date={vehicle.inspectionExpiresOn}
                              expiredLabel={t.transport.expired}
                              soonLabel={t.transport.expiringSoon}
                              missingLabel={t.transport.noExpiryRecorded}
                              locale={locale}
                            />
                          ) : null}
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function ExpiryBadge({
  state,
  label,
  date,
  expiredLabel,
  soonLabel,
  missingLabel,
  locale,
}: {
  state: ReturnType<typeof expiryState>;
  label: string;
  date: string | null;
  expiredLabel: string;
  soonLabel: string;
  missingLabel: string;
  locale: Parameters<typeof formatDate>[1];
}) {
  const suffix =
    state === "UNKNOWN"
      ? missingLabel
      : `${state === "EXPIRED" ? expiredLabel : soonLabel}${
          date ? ` · ${formatDate(date, locale)}` : ""
        }`;

  return (
    <Badge variant={state === "EXPIRED" ? "destructive" : "secondary"}>
      {label}: {suffix}
    </Badge>
  );
}
