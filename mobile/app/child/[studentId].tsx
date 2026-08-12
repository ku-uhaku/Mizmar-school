import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBadges, useChild, useChildDossier } from "../../src/api/hooks";
import { interpolate, useFormat, useT } from "../../src/i18n";
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
  const t = useT();
  const fmt = useFormat();
  const { studentId } = useLocalSearchParams<{ studentId: string }>();

  const detail = useChild(studentId);
  // The dossier is its own read because its badge — "2 manquantes" — is the one
  // thing on this screen a parent can actually act on, so it should not wait
  // behind the fee schedule.
  const dossier = useChildDossier(studentId);
  // The one count on this screen that the child's own data cannot supply: an
  // announcement is new or it is not, and only the watermark knows which.
  const badges = useBadges();

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
          title: detail.data?.child.firstName ?? t.childMenu.defaultTitle,
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
          <ErrorNote message={t.childMenu.loadError} />
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
                  value={detail.data.marks.average ?? "—"}
                  label={interpolate(t.childMenu.averageOf, {
                    max: detail.data.marks.outOf,
                  })}
                  tone={
                    detail.data.marks.average === null
                      ? "default"
                      : detail.data.marks.average >= detail.data.marks.passMark
                        ? "success"
                        : "danger"
                  }
                />
                <Stat
                  value={fmt.money(detail.data.fees.outstandingCentimes)}
                  label={t.childMenu.outstanding}
                  tone={detail.data.fees.isUpToDate ? "success" : "warning"}
                />
                <Stat
                  value={detail.data.attendance.unjustifiedCount}
                  label={t.childMenu.unjustifiedAbsences}
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
                label={t.childMenu.tiles.notes}
                icon="notebook-outline"
                hint={t.childMenu.tiles.notesHint}
                badge={
                  detail.data.marks.marks.length > 0
                    ? String(detail.data.marks.marks.length)
                    : undefined
                }
                onPress={() => go("notes")}
              />
              <Tile
                label={t.childMenu.tiles.absences}
                icon="calendar-remove-outline"
                hint={t.childMenu.tiles.absencesHint}
                badge={
                  detail.data.attendance.unjustifiedCount > 0
                    ? interpolate(t.childMenu.unjustifiedShort, {
                        count: detail.data.attendance.unjustifiedCount,
                      })
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
                label={t.childMenu.tiles.remarks}
                icon="comment-text-outline"
                hint={t.childMenu.tiles.remarksHint}
                onPress={() => go("remarques")}
              />
              <Tile
                label={t.childMenu.tiles.timetable}
                icon="timetable"
                hint={t.childMenu.tiles.timetableHint}
                onPress={() => go("emploi-du-temps")}
              />
              <Tile
                label={t.childMenu.tiles.payments}
                icon="cash-multiple"
                hint={t.childMenu.tiles.paymentsHint}
                badge={
                  detail.data.fees.isUpToDate
                    ? undefined
                    : fmt.money(detail.data.fees.outstandingCentimes)
                }
                tone={
                  detail.data.fees.overdueCentimes > 0 ? "danger" : "warning"
                }
                onPress={() => go("paiements")}
              />
              <Tile
                label={t.childMenu.tiles.dossier}
                icon="folder-account-outline"
                hint={t.childMenu.tiles.dossierHint}
                badge={
                  missingPieces > 0
                    ? interpolate(t.childMenu.missingPieces, { count: missingPieces })
                    : undefined
                }
                tone={missingPieces > 0 ? "warning" : "default"}
                onPress={() => go("dossier")}
              />
              <Tile
                label={t.childMenu.tiles.supplies}
                icon="bag-personal-outline"
                hint={t.childMenu.tiles.suppliesHint}
                onPress={() => go("fournitures")}
              />
              <Tile
                label={t.childMenu.tiles.transport}
                icon="bus"
                hint={t.childMenu.tiles.transportHint}
                badge={detail.data.transport ? undefined : t.childMenu.none}
                onPress={() => go("transport")}
              />
              <Tile
                label={t.childMenu.tiles.events}
                icon="calendar-star"
                hint={t.childMenu.tiles.eventsHint}
                badge={
                  badges.data && badges.data.events > 0
                    ? interpolate(t.childMenu.newEvents, { count: badges.data.events })
                    : undefined
                }
                tone={
                  badges.data && badges.data.events > 0 ? "warning" : "default"
                }
                onPress={() => go("evenements")}
              />
            </TileGrid>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}
