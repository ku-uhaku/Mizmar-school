import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useChild, useChildDossier } from "../../src/api/hooks";
import {
  Caption,
  Card,
  ErrorNote,
  Loading,
  Stat,
  Tile,
  TileGrid,
  Title,
} from "../../src/ui/components";
import { money } from "../../src/ui/format";
import { spacing, useTheme } from "../../src/ui/theme";

/**
 * One child, as a menu.
 *
 * ── Why a grid and not the long page this used to be ────────────────────────
 * It was four stacked sections — résultats, assiduité, scolarité, bus — and a
 * parent looking for one of them scrolled past the other three every time. The
 * four became six and the scroll became the screen's whole character.
 *
 * A grid says what is *there* in one glance, which is the question a parent
 * opens the app with, and each tile carries the one figure that decides whether
 * it needs opening at all: three unjustified absences, two missing pièces, a
 * balance outstanding. A tile with nothing to report shows no badge rather than
 * a green zero, so the eye goes to the ones that do — the same rule the web
 * dashboard's section cards follow.
 *
 * The three figures above the grid are the ones a parent checks *without*
 * wanting detail: the average, what is owed, whether the register is clean.
 * Everything else is one tap.
 */
export default function ChildScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { studentId } = useLocalSearchParams<{ studentId: string }>();

  const detail = useChild(studentId);
  // The dossier is its own read because its badge — "2 manquantes" — is the one
  // thing on this screen a parent can actually act on, so it should not wait
  // behind the fee schedule.
  const dossier = useChildDossier(studentId);

  const go = (topic: string) =>
    router.push({
      pathname: "/child/[studentId]/[topic]",
      params: { studentId, topic },
    });

  const missingPieces = dossier.data
    ? dossier.data.requiredCount - dossier.data.providedCount
    : 0;

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

            {/* The three a parent checks without wanting detail. */}
            <Card>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.md,
                }}
              >
                <Stat
                  value={detail.data.marks.averageOutOf20 ?? "—"}
                  label="Moyenne /20"
                  tone={
                    detail.data.marks.averageOutOf20 === null
                      ? "default"
                      : detail.data.marks.averageOutOf20 >= 10
                        ? "success"
                        : "danger"
                  }
                />
                <Stat
                  value={money(detail.data.fees.outstandingCentimes)}
                  label="Reste à payer"
                  tone={detail.data.fees.isUpToDate ? "success" : "warning"}
                />
                <Stat
                  value={detail.data.attendance.unjustifiedCount}
                  label="Absences non justifiées"
                  tone={
                    detail.data.attendance.unjustifiedCount > 0
                      ? "danger"
                      : "success"
                  }
                />
              </View>
            </Card>

            <TileGrid>
              <Tile
                label="Notes"
                icon="notebook-outline"
                hint="Les résultats publiés"
                badge={
                  detail.data.marks.marks.length > 0
                    ? String(detail.data.marks.marks.length)
                    : undefined
                }
                onPress={() => go("notes")}
              />
              <Tile
                label="Absences"
                icon="calendar-remove-outline"
                hint="Le registre d'assiduité"
                badge={
                  detail.data.attendance.unjustifiedCount > 0
                    ? `${detail.data.attendance.unjustifiedCount} non just.`
                    : undefined
                }
                tone={
                  detail.data.attendance.unjustifiedCount > 0
                    ? "danger"
                    : "default"
                }
                onPress={() => go("absences")}
              />
              <Tile
                label="Remarques"
                icon="comment-text-outline"
                hint="Le carnet de liaison"
                onPress={() => go("remarques")}
              />
              <Tile
                label="Emploi du temps"
                icon="timetable"
                hint="La semaine de la classe"
                onPress={() => go("emploi-du-temps")}
              />
              <Tile
                label="Paiements"
                icon="cash-multiple"
                hint="L'échéancier et ce qui reste"
                badge={
                  detail.data.fees.isUpToDate
                    ? undefined
                    : money(detail.data.fees.outstandingCentimes)
                }
                tone={
                  detail.data.fees.overdueCentimes > 0 ? "danger" : "warning"
                }
                onPress={() => go("paiements")}
              />
              <Tile
                label="Dossier"
                icon="folder-account-outline"
                hint="Les pièces demandées"
                badge={
                  missingPieces > 0 ? `${missingPieces} manquantes` : undefined
                }
                tone={missingPieces > 0 ? "warning" : "default"}
                onPress={() => go("dossier")}
              />
              <Tile
                label="Transport"
                icon="bus"
                hint="Le circuit et l'arrêt"
                badge={detail.data.transport ? undefined : "Aucun"}
                onPress={() => go("transport")}
              />
              <Tile
                label="Événements"
                icon="calendar-star"
                hint="Ce que l'école annonce"
                onPress={() => go("evenements")}
              />
            </TileGrid>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}
