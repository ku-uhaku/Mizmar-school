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
  isoDay,
  label,
  longDate,
} from "../ui/format";
import { spacing } from "../ui/theme";

/**
 * The chauffeur's morning: the circuits this bus is making today.
 *
 * Tapping one opens its register — who is expected, at which stop, in the order
 * the bus meets them.
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
            <Pressable>
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
                          : run.status === "DEPARTED"
                            ? "warning"
                            : "default"
                    }
                  >
                    {label(RUN_STATUS_LABELS, run.status)}
                  </Badge>
                </View>

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
