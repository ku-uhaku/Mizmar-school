import { Link } from "expo-router";
import { Pressable, View } from "react-native";

import { useDriverDay } from "../api/hooks";
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
import {
  DIRECTION_LABELS,
  RUN_STATUS_LABELS,
  RUN_WINDOW_LABELS,
  isoDay,
  label,
  longDate,
} from "../ui/format";
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
  const today = isoDay(new Date());
  const day = useDriverDay(today);

  if (day.isPending) return <Loading />;

  if (day.isError) {
    return <ErrorNote message="Impossible de charger les circuits du jour." />;
  }

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <Heading>Mes circuits</Heading>
        <Caption>{longDate(new Date())}</Caption>
      </View>

      {day.data.runs.length === 0 ? (
        <Empty message="Aucun circuit prévu aujourd'hui." />
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
                      {label(DIRECTION_LABELS, run.direction)} · {run.scheduleName}
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
                    {label(RUN_STATUS_LABELS, run.status)}
                  </Badge>
                </View>

                {/* Only worth saying while nothing has happened yet — once the
                    bus is out, or back, the status says it better. */}
                {run.status === "PLANNED" && run.window !== "OPEN" ? (
                  <Row
                    label={label(RUN_WINDOW_LABELS, run.window)}
                    value={
                      run.window === "UPCOMING"
                        ? `à ${run.plannedDepartureTime}`
                        : "non effectué"
                    }
                    tone={run.window === "UPCOMING" ? "default" : "danger"}
                  />
                ) : null}

                <Row label="Élèves attendus" value={run.riderCount} />
                {run.vehicleRegistration ? (
                  <Row label="Véhicule" value={run.vehicleRegistration} />
                ) : null}
                {run.delayMinutes !== null ? (
                  <Row
                    label="Départ"
                    value={
                      run.delayMinutes > 0
                        ? `${run.delayMinutes} min de retard`
                        : "à l'heure"
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
