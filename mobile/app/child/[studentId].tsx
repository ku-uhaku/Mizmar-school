import { Stack, useLocalSearchParams } from "expo-router";
import { Linking, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useChild } from "../../src/api/hooks";
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  Divider,
  Empty,
  ErrorNote,
  Heading,
  Loading,
  Row,
  Stat,
  Title,
} from "../../src/ui/components";
import {
  ATTENDANCE_LABELS,
  DIRECTION_LABELS,
  label,
  money,
  shortDate,
} from "../../src/ui/format";
import { spacing, useTheme } from "../../src/ui/theme";

/**
 * One child, four things: how they are doing, how often they are there, what
 * is owed, and which bus they take.
 *
 * The order is deliberate — it is the order a parent asks in.
 */
export default function ChildScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const detail = useChild(studentId);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: detail.data?.child.firstName ?? "Élève",
        }}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
      >
        {detail.isPending ? <Loading /> : null}
        {detail.isError ? (
          <ErrorNote message="Impossible de charger la fiche de l'élève." />
        ) : null}

        {detail.data ? (
          <>
            <View style={{ gap: 2 }}>
              <Title>{detail.data.child.fullName}</Title>
              <Caption>
                {[
                  detail.data.child.levelName,
                  detail.data.child.className,
                  detail.data.child.code,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Caption>
            </View>

            {/* Résultats */}
            <Card>
              <Heading>Résultats</Heading>
              {detail.data.marks.marks.length === 0 ? (
                <Empty message="Aucune note publiée pour le moment." />
              ) : (
                <>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
                    <Stat
                      value={detail.data.marks.averageOutOf20 ?? "—"}
                      label="Moyenne générale /20"
                      tone={
                        (detail.data.marks.averageOutOf20 ?? 0) >= 10
                          ? "success"
                          : "warning"
                      }
                    />
                    <Stat
                      value={detail.data.marks.marks.length}
                      label="Notes publiées"
                    />
                  </View>

                  <Divider />

                  {detail.data.marks.marks.slice(0, 8).map((mark) => (
                    <Row
                      key={mark.id}
                      label={`${mark.subjectName} — ${mark.typeName}`}
                      value={
                        mark.isAbsent
                          ? "Absent"
                          : `${mark.score ?? "—"} / ${mark.maxScore}`
                      }
                      tone={
                        mark.isAbsent
                          ? "warning"
                          : (mark.score ?? 0) / mark.maxScore >= 0.5
                            ? "success"
                            : "danger"
                      }
                    />
                  ))}
                </>
              )}
            </Card>

            {/* Assiduité */}
            <Card>
              <Heading>Assiduité</Heading>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
                <Stat
                  value={detail.data.attendance.missedCount}
                  label="Absences"
                  tone={detail.data.attendance.missedCount > 0 ? "warning" : "success"}
                />
                <Stat
                  value={detail.data.attendance.unjustifiedCount}
                  label="Non justifiées"
                  tone={
                    detail.data.attendance.unjustifiedCount > 0 ? "danger" : "success"
                  }
                />
              </View>

              {detail.data.attendance.entries.length === 0 ? (
                <Body muted>Aucune absence enregistrée cette année.</Body>
              ) : (
                <>
                  <Divider />
                  {detail.data.attendance.entries.slice(0, 8).map((entry) => (
                    <Row
                      key={entry.id}
                      label={`${shortDate(entry.date)}${
                        entry.subjectName ? ` · ${entry.subjectName}` : ""
                      }`}
                      value={`${label(ATTENDANCE_LABELS, entry.status)}${
                        entry.isJustified ? " (justifié)" : ""
                      }`}
                      tone={entry.isJustified ? "default" : "warning"}
                    />
                  ))}
                </>
              )}
            </Card>

            {/* Scolarité */}
            <Card>
              <Heading>Scolarité</Heading>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
                <Stat
                  value={money(detail.data.fees.outstandingCentimes)}
                  label="Reste à payer"
                  tone={detail.data.fees.isUpToDate ? "default" : "warning"}
                />
                <Stat
                  value={money(detail.data.fees.overdueCentimes)}
                  label="Échu"
                  tone={detail.data.fees.overdueCentimes > 0 ? "danger" : "success"}
                />
              </View>

              <Badge tone={detail.data.fees.isUpToDate ? "success" : "danger"}>
                {detail.data.fees.isUpToDate ? "À jour" : "Échéance dépassée"}
              </Badge>

              <Divider />

              {detail.data.fees.lines
                .filter((line) => line.outstandingCentimes > 0)
                .slice(0, 8)
                .map((line) => (
                  <Row
                    key={line.id}
                    label={`${line.label} · ${shortDate(line.dueDate)}`}
                    value={money(line.outstandingCentimes)}
                    tone={line.isOverdue ? "danger" : "default"}
                  />
                ))}
            </Card>

            {/* Transport */}
            {detail.data.transport ? (
              <Card>
                <Heading>Transport</Heading>
                <Row label="Circuit" value={detail.data.transport.routeName} />
                <Row label="Arrêt" value={detail.data.transport.stopName} />
                <Row
                  label="Sens"
                  value={label(DIRECTION_LABELS, detail.data.transport.direction)}
                />
                {detail.data.transport.vehiclePlate ? (
                  <Row label="Véhicule" value={detail.data.transport.vehiclePlate} />
                ) : null}
                {detail.data.transport.driverName ? (
                  <Row label="Chauffeur" value={detail.data.transport.driverName} />
                ) : null}

                {detail.data.transport.driverPhone ? (
                  <>
                    <Divider />
                    <Button
                      label={`Appeler ${detail.data.transport.driverPhone}`}
                      variant="ghost"
                      onPress={() =>
                        Linking.openURL(`tel:${detail.data!.transport!.driverPhone}`)
                      }
                    />
                  </>
                ) : null}
              </Card>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </>
  );
}
