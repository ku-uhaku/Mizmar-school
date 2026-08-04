import { View } from "react-native";

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
} from "../ui/components";
import { isoDay, longDate } from "../ui/format";
import { spacing } from "../ui/theme";

/**
 * The teacher's day.
 *
 * Read-only on purpose: marking a register on a phone means marking thirty
 * children on a phone, and the web workspace does that far better. What this
 * answers is the question a teacher actually has in the corridor — where am I
 * next, and what have I not finished.
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

      <Heading>Emploi du temps</Heading>

      {lessons.length === 0 ? (
        <Empty message="Aucune séance aujourd'hui." />
      ) : (
        lessons.map((lesson) => (
          <Card key={lesson.timetableEntryId}>
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
                {lesson.roomCode ? <Caption>Salle {lesson.roomCode}</Caption> : null}
              </View>

              <Badge tone={lesson.isMarked ? "success" : "warning"}>
                {lesson.isMarked ? "Appel fait" : "Appel à faire"}
              </Badge>
            </View>
          </Card>
        ))
      )}
    </View>
  );
}
