import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { useTeacherDay } from "../api/hooks";
import { interpolate, isoDay, useFormat, useT } from "../i18n";
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
  const t = useT();
  const fmt = useFormat();
  const today = isoDay(new Date());
  const day = useTeacherDay(today);

  if (day.isPending) return <Loading />;

  if (day.isError) {
    return <ErrorNote message={t.teacherSpace.loadError} />;
  }

  const { summary, lessons } = day.data;

  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <Heading>{t.teacherSpace.today}</Heading>
        <Caption>{fmt.longDate(new Date())}</Caption>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: spacing.md,
            marginTop: spacing.sm,
          }}
        >
          <Stat value={summary.lessonsToday} label={t.teacherSpace.sessions} />
          <Stat
            value={summary.registersLeftToday}
            label={t.teacherSpace.registersToDo}
            tone={summary.registersLeftToday > 0 ? "warning" : "success"}
          />
          <Stat value={summary.classCount} label={t.teacherSpace.classes} />
          <Stat value={summary.pupilCount} label={t.teacherSpace.pupils} />
        </View>

        {summary.papersToMark > 0 ? (
          <>
            <Divider />
            <Body>
              {interpolate(t.teacherSpace.papersToMark, {
                count: summary.papersToMark,
              })}
            </Body>
          </>
        ) : null}
      </Card>

      <TileGrid>
        <Tile
          label={t.teacherSpace.tiles.corrections}
          hint={t.teacherSpace.tiles.correctionsHint}
          icon="clipboard-check-outline"
          badge={
            summary.papersToMark > 0 ? String(summary.papersToMark) : undefined
          }
          tone={summary.papersToMark > 0 ? "warning" : "default"}
          onPress={() => router.push("/assessments")}
        />
        <Tile
          label={t.teacherSpace.tiles.timetable}
          hint={t.teacherSpace.tiles.timetableHint}
          icon="calendar-month-outline"
          onPress={() => router.push("/teacher/timetable")}
        />
        <Tile
          label={t.teacherSpace.tiles.newAssessment}
          hint={t.teacherSpace.tiles.newAssessmentHint}
          icon="file-plus-outline"
          onPress={() => router.push("/assessments/new")}
        />
        <Tile
          label={t.teacherSpace.tiles.remarks}
          hint={t.teacherSpace.tiles.remarksHint}
          icon="comment-text-outline"
          badge={
            summary.remarksThisMonth > 0
              ? String(summary.remarksThisMonth)
              : undefined
          }
          onPress={() => router.push("/remark")}
        />
        <Tile
          label={t.teacherSpace.tiles.supplies}
          hint={t.teacherSpace.tiles.suppliesHint}
          icon="package-variant-closed"
          onPress={() => router.push("/supplies")}
        />
      </TileGrid>

      <Heading>{t.teacherSpace.today}</Heading>

      {lessons.length === 0 ? (
        <Empty message={t.teacherSpace.noLessonsToday} />
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
                    <Caption>
                      {interpolate(t.teacherSpace.room, { code: lesson.roomCode })}
                    </Caption>
                  ) : null}
                </View>

                <Badge tone={lesson.isMarked ? "success" : "warning"}>
                  {lesson.isMarked
                    ? t.teacherSpace.registerDone
                    : t.teacherSpace.registerToDo}
                </Badge>
              </View>
            </Card>
          </Pressable>
        ))
      )}
    </View>
  );
}
