import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { useTeacherDay } from "../api/hooks";
import {
  Badge,
  Body,
  Caption,
  Card,
  Divider,
  Empty,
  ErrorNote,
  Heading,
  Loading,
  Stat,
  Tile,
  TileGrid,
} from "../ui/components";
import { isoDay, longDate } from "../ui/format";
import { spacing } from "../ui/theme";

/**
 * The teacher's day.
 *
 * It answers the question a teacher has in the corridor — where am I next, and
 * what have I not finished — and now lets them act on it: a lesson opens its
 * register, and a remark can be written without waiting to be back at a desk.
 * The heavy end of both (minutes late, a reason, releasing a remark to the
 * family) stays on the web, which is where a teacher sitting down to do it
 * properly already is.
 */
export function TeacherSpace() {
  const today = isoDay(new Date());
  const day = useTeacherDay(today);

  if (day.isPending) return <Loading />;

  if (day.isError) {
    return <ErrorNote message="Impossible de charger la journée." />;
  }

  const { summary, lessons } = day.data;

  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <Heading>Aujourd&apos;hui</Heading>
        <Caption>{longDate(new Date())}</Caption>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: spacing.md,
            marginTop: spacing.sm,
          }}
        >
          <Stat value={summary.lessonsToday} label="Séances" />
          <Stat
            value={summary.registersLeftToday}
            label="Appels à faire"
            tone={summary.registersLeftToday > 0 ? "warning" : "success"}
          />
          <Stat value={summary.classCount} label="Classes" />
          <Stat value={summary.pupilCount} label="Élèves" />
        </View>

        {summary.papersToMark > 0 ? (
          <>
            <Divider />
            <Body>
              {summary.papersToMark} copie(s) en attente de correction.
            </Body>
          </>
        ) : null}
      </Card>

      <TileGrid>
        <Tile
          label="Corrections"
          hint="Devoirs et contrôles à noter"
          icon="clipboard-check-outline"
          badge={
            summary.papersToMark > 0 ? String(summary.papersToMark) : undefined
          }
          tone={summary.papersToMark > 0 ? "warning" : "default"}
          onPress={() => router.push("/assessments")}
        />
        <Tile
          label="Emploi du temps"
          hint="Ma semaine"
          icon="calendar-month-outline"
          onPress={() => router.push("/teacher/timetable")}
        />
        <Tile
          label="Nouveau devoir"
          hint="Donner un travail à noter"
          icon="file-plus-outline"
          onPress={() => router.push("/assessments/new")}
        />
        <Tile
          label="Remarques"
          hint="Observations et validation"
          icon="comment-text-outline"
          badge={
            summary.remarksThisMonth > 0
              ? String(summary.remarksThisMonth)
              : undefined
          }
          onPress={() => router.push("/remark")}
        />
        <Tile
          label="Fournitures"
          hint="Demander du matériel"
          icon="package-variant-closed"
          onPress={() => router.push("/supplies")}
        />
      </TileGrid>

      <Heading>Aujourd&apos;hui</Heading>

      {lessons.length === 0 ? (
        <Empty message="Aucune séance aujourd'hui." />
      ) : (
        lessons.map((lesson) => (
          <Pressable
            key={lesson.timetableEntryId}
            onPress={() =>
              router.push({
                pathname: "/lesson/[timetableEntryId]",
                params: {
                  timetableEntryId: lesson.timetableEntryId,
                  schoolClassId: lesson.schoolClassId,
                  // Empty rather than omitted: a whole-day register has no
                  // subject or period, and the route reads "" as null.
                  subjectId: lesson.subjectId ?? "",
                  timeSlotId: lesson.timeSlotId ?? "",
                  date: today,
                },
              })
            }
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
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
                    {lesson.startTime} — {lesson.endTime}
                  </Heading>
                  <Body>
                    {lesson.subjectName} · {lesson.classCode}
                    {lesson.groupLabel ? ` (${lesson.groupLabel})` : ""}
                  </Body>
                  {lesson.roomCode ? (
                    <Caption>Salle {lesson.roomCode}</Caption>
                  ) : null}
                </View>

                <Badge tone={lesson.isMarked ? "success" : "warning"}>
                  {lesson.isMarked ? "Appel fait" : "Appel à faire"}
                </Badge>
              </View>
            </Card>
          </Pressable>
        ))
      )}
    </View>
  );
}
