import { Link } from "expo-router";
import { Pressable, View } from "react-native";

import { useDriverDay } from "../api/hooks";
import { interpolate, isoDay, label, useFormat, useT } from "../i18n";
import {
  Badge,
  Body,
  Caption,
  Card,
  Empty,
  ErrorNote,
  Heading,
  Loading,
  Row,
} from "../ui/components";
import { spacing } from "../ui/theme";

/**
 * The chauffeur's morning: the circuits this bus is making today.
 *
 * The whole day is listed, but only the voyage at its hour is live — the others
 * are dimmed and say when they are. A driver has to be able to see that he has
 * an afternoon return; what he must not be able to do is start it at seven, or
 * take its register while sitting in the morning one. See `window` on TripRun.
 *
 * Tapping the live one opens it: départ, then the names, then l'arrivée.
 */
export function DriverSpace() {
  const t = useT();
  const fmt = useFormat();
  const today = isoDay(new Date());
  const day = useDriverDay(today);

  if (day.isPending) return <Loading />;

  if (day.isError) {
    return <ErrorNote message={t.driverSpace.loadError} />;
  }

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <Heading>{t.driverSpace.myRuns}</Heading>
        <Caption>{fmt.longDate(new Date())}</Caption>
      </View>

      {day.data.runs.length === 0 ? (
        <Empty message={t.driverSpace.noRunsToday} />
      ) : (
        day.data.runs.map((run) => (
          <Link
            key={run.id}
            href={{ pathname: "/run/[runId]", params: { runId: run.id } }}
            asChild
          >
            <Pressable
              // Still tappable outside its window: the screen behind explains
              // why nothing can be done there, which is a better answer than a
              // card that ignores the finger.
              style={{ opacity: run.window === "OPEN" ? 1 : 0.55 }}
            >
              <Card>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: spacing.md,
                  }}
                >
                  <View style={{ flexShrink: 1, gap: 2 }}>
                    <Heading>
                      {run.plannedDepartureTime} · {run.routeName}
                    </Heading>
                    <Body muted>
                      {label(t.labels.direction, run.direction)} · {run.scheduleName}
                    </Body>
                  </View>

                  <Badge
                    tone={
                      run.status === "CANCELLED"
                        ? "danger"
                        : run.status === "ARRIVED"
                          ? "success"
                          : run.status === "EN_ROUTE"
                            ? "warning"
                            : "default"
                    }
                  >
                    {label(t.labels.runStatus, run.status)}
                  </Badge>
                </View>

                {/* Only worth saying while nothing has happened yet — once the
                    bus is out, or back, the status says it better. */}
                {run.status === "PLANNED" && run.window !== "OPEN" ? (
                  <Row
                    label={label(t.labels.runWindow, run.window)}
                    value={
                      run.window === "UPCOMING"
                        ? interpolate(t.driverSpace.opensAt, {
                            time: run.plannedDepartureTime,
                          })
                        : t.driverSpace.notDone
                    }
                    tone={run.window === "UPCOMING" ? "default" : "danger"}
                  />
                ) : null}

                <Row label={t.driverSpace.expectedStudents} value={run.riderCount} />
                {run.vehicleRegistration ? (
                  <Row label={t.driverSpace.vehicle} value={run.vehicleRegistration} />
                ) : null}
                {run.delayMinutes !== null ? (
                  <Row
                    label={t.driverSpace.departure}
                    value={
                      run.delayMinutes > 0
                        ? interpolate(t.driverSpace.lateByMinutes, {
                            count: run.delayMinutes,
                          })
                        : t.driverSpace.onTime
                    }
                    tone={run.delayMinutes > 5 ? "danger" : "success"}
                  />
                ) : null}
              </Card>
            </Pressable>
          </Link>
        ))
      )}
    </View>
  );
}
