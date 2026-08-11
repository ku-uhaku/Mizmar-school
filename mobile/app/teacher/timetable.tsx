import { Stack } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTeacherWeek } from "../../src/api/hooks";
import { label, useT } from "../../src/i18n";
import {
  Card,
  Empty,
  ErrorNote,
  Loading,
  Stat,
} from "../../src/ui/components";
import { radius, spacing, useTheme } from "../../src/ui/theme";

/**
 * The teacher's own week.
 *
 * Drawn as the same grid the family screen draws for a child, and deliberately
 * so — a parent and a teacher talking about "the blue one on Tuesday" should
 * mean the same lesson. What differs is what a cell says and what an empty one
 * means: this names the *class*, since the teacher's own name in thirty cells
 * is the one fact they already know, and a blank is a free period rather than
 * an hour the school does not teach.
 *
 * Days down and periods across, with the day column pinned outside the
 * horizontal scroll: a phone cannot show eight periods at a readable width, and
 * a table whose row labels scroll away is a table you cannot read.
 */
export default function TeacherTimetableScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const [scheduleKind, setScheduleKind] = useState<"STANDARD" | "RAMADAN">(
    "STANDARD",
  );

  const week = useTeacherWeek(scheduleKind);

  const DAY_W = 58;
  const CELL_W = 108;
  const ROW_H = 66;

  const headerCell = {
    height: 34,
    justifyContent: "center" as const,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
  };

  const data = week.data;
  // Breaks are dropped: a recreation is not a period a teacher is booked for,
  // and a column of empty grey cells is width the grid cannot spare on a phone.
  const columns = data?.columns.filter((column) => !column.isBreak) ?? [];

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: t.teacherTimetable.title }}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
      >
        {week.isPending ? <Loading /> : null}
        {week.isError ? (
          <ErrorNote message={t.teacherTimetable.loadError} />
        ) : null}

        {data ? (
          <>
            <Card>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.md,
                }}
              >
                <Stat value={data.lessonCount} label={t.teacherTimetable.sessionsPerWeek} />
                <Stat value={data.classCount} label={t.teacherTimetable.classes} />
              </View>
            </Card>

            {/* Moroccan schools compress the day for Ramadan; the grid is
                stored twice rather than rewritten, so this only chooses which
                one to read. */}
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {(["STANDARD", "RAMADAN"] as const).map((kind) => (
                <Segment
                  key={kind}
                  label={kind === "STANDARD" ? t.teacherTimetable.standard : t.teacherTimetable.ramadan}
                  selected={scheduleKind === kind}
                  onPress={() => setScheduleKind(kind)}
                />
              ))}
            </View>

            {columns.length === 0 || data.rows.length === 0 ? (
              <Empty message={t.teacherTimetable.none} />
            ) : (
              <View
                style={{
                  flexDirection: "row",
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderRadius: radius.md,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: DAY_W,
                    borderRightWidth: StyleSheet.hairlineWidth,
                    borderColor: theme.border,
                  }}
                >
                  <View style={headerCell} />
                  {data.rows.map((row) => (
                    <View
                      key={row.dayOfWeek}
                      style={{
                        height: ROW_H,
                        justifyContent: "center",
                        paddingHorizontal: spacing.sm,
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderColor: theme.border,
                      }}
                    >
                      <Text
                        style={{
                          color: theme.text,
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        {label(t.labels.weekday, String(row.dayOfWeek)).slice(
                          0,
                          3,
                        )}
                      </Text>
                    </View>
                  ))}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    <View style={{ flexDirection: "row" }}>
                      {columns.map((column) => (
                        <View
                          key={column.key}
                          style={{ ...headerCell, width: CELL_W }}
                        >
                          <Text
                            style={{
                              color: theme.muted,
                              fontSize: 11,
                              fontWeight: "600",
                            }}
                          >
                            {column.startTime}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {data.rows.map((row) => (
                      <View
                        key={row.dayOfWeek}
                        style={{ flexDirection: "row" }}
                      >
                        {columns.map((column) => {
                          const lesson = row.cells[column.key] ?? null;
                          return (
                            <View
                              key={column.key}
                              style={{
                                width: CELL_W,
                                height: ROW_H,
                                padding: spacing.sm,
                                justifyContent: "center",
                                borderTopWidth: StyleSheet.hairlineWidth,
                                borderLeftWidth: StyleSheet.hairlineWidth,
                                borderColor: theme.border,
                                // The same alpha the desktop grid tints with,
                                // so the two read as one colour scheme.
                                backgroundColor: lesson?.colorHex
                                  ? `${lesson.colorHex}22`
                                  : undefined,
                              }}
                            >
                              {lesson ? (
                                <>
                                  <Text
                                    style={{
                                      color: theme.text,
                                      fontSize: 12,
                                      fontWeight: "700",
                                    }}
                                    numberOfLines={1}
                                  >
                                    {lesson.classCode}
                                    {lesson.groupLabel
                                      ? ` ${lesson.groupLabel}`
                                      : ""}
                                  </Text>
                                  <Text
                                    style={{ color: theme.muted, fontSize: 10 }}
                                    numberOfLines={1}
                                  >
                                    {lesson.subjectShort || lesson.subjectName}
                                  </Text>
                                  {lesson.roomCode ? (
                                    <Text
                                      style={{
                                        color: theme.muted,
                                        fontSize: 10,
                                      }}
                                      numberOfLines={1}
                                    >
                                      {lesson.roomCode}
                                    </Text>
                                  ) : null}
                                </>
                              ) : (
                                // Drawn, not skipped: a blank cell is what tells
                                // a teacher they are free then.
                                <Text
                                  style={{ color: theme.muted, fontSize: 12 }}
                                >
                                  —
                                </Text>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

/** One of the two horaires. Two options, so `FilterChips` would draw nothing. */
function Segment({
  label: text,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        paddingVertical: 10,
        borderRadius: radius.sm,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: selected ? theme.primary : theme.border,
        backgroundColor: selected ? `${theme.primary}1a` : theme.card,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          color: selected ? theme.primary : theme.muted,
          fontSize: 13,
          fontWeight: selected ? "700" : "500",
        }}
      >
        {text}
      </Text>
    </Pressable>
  );
}
