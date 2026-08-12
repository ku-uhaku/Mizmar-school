import { Stack, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useMarkSeen,
  useChild,
  useChildSupplies,
  useChildDossier,
  useChildRemarks,
  useChildTimetable,
  useEvents,
} from "../../../src/api/hooks";
import { interpolate, label, useFormat, useT } from "../../../src/i18n";
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  Divider,
  Empty,
  ErrorNote,
  FilterChips,
  Heading,
  Loading,
  Row,
  Stat,
} from "../../../src/ui/components";
import { radius, spacing, useTheme } from "../../../src/ui/theme";
import { useChecklist } from "../../../src/ui/use-checklist";

/**
 * One topic of one child.
 *
 * ── One route for eight topics ──────────────────────────────────────────────
 * Eight files would be eight copies of the same header, the same scroll view,
 * the same loading and error handling, and eight chances for one of them to
 * drift. What actually differs is the title and the body, so the topic travels
 * in the URL and the body is a switch. Each still gets its own route — a real
 * back button, a deep link, and only its own data fetched.
 *
 * An unknown topic renders the empty state rather than throwing: the segment
 * comes from a URL, and a stale deep link is not a crash.
 */

/** The chip that clears a filter. A value, not a separate reset button. */
const ALL = "__all__";

/** The topics that carry a badge, and what each is called on the server. */
const SEEN_FOR: Record<string, "EVENTS" | "MARKS" | "REMARKS"> = {
  evenements: "EVENTS",
  notes: "MARKS",
  remarques: "REMARKS",
};

export default function TopicScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const { studentId, topic } = useLocalSearchParams<{
    studentId: string;
    topic: string;
  }>();

  // Opening the screen is what clears its badge. Topics with no badge — the
  // timetable, the dossier — stamp nothing.
  const markSeen = useMarkSeen();
  useEffect(() => {
    const seen = SEEN_FOR[topic];
    if (seen) markSeen.mutate(seen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic]);

  const titles: Record<string, string> = t.topic.titles;

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: titles[topic] ?? t.topic.defaultTitle }}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
      >
        <TopicBody studentId={studentId} topic={topic} />
      </ScrollView>
    </>
  );
}

function TopicBody({ studentId, topic }: { studentId: string; topic: string }) {
  const t = useT();

  switch (topic) {
    case "notes":
      return <Notes studentId={studentId} />;
    case "absences":
      return <Absences studentId={studentId} />;
    case "remarques":
      return <Remarques studentId={studentId} />;
    case "emploi-du-temps":
      return <Timetable studentId={studentId} />;
    case "paiements":
      return <Payments studentId={studentId} />;
    case "dossier":
      return <DossierView studentId={studentId} />;
    case "fournitures":
      return <Supplies studentId={studentId} />;
    case "transport":
      return <Transport studentId={studentId} />;
    case "evenements":
      return <Events />;
    default:
      return <Empty message={t.topic.unknown} />;
  }
}

/** The four topics that come off the child's own detail read. */
function useDetail(studentId: string) {
  const t = useT();
  const detail = useChild(studentId);
  return {
    detail,
    guard: detail.isPending ? (
      <Loading />
    ) : detail.isError ? (
      <ErrorNote message={t.topic.loadError} />
    ) : null,
  };
}

function Notes({ studentId }: { studentId: string }) {
  const t = useT();
  const fmt = useFormat();
  const { detail, guard } = useDetail(studentId);
  // Declared before the early returns: a hook may not be called conditionally,
  // and the guard above returns.
  const [term, setTerm] = useState(ALL);
  const [subject, setSubject] = useState(ALL);

  if (guard) return guard;
  if (!detail.data) return null;

  const { marks, average, outOf, passMark } = detail.data.marks;

  /*
    By term, because that is the unit a parent asks in — "how was the first
    semester?" — and because a year's marks are a long scroll by March. Subject
    would be the other candidate; it loses to term because the subject is
    already on every row and the term is not.

    The options come from the marks themselves rather than from a list of the
    year's terms: a term with no marks yet is a chip that answers "nothing",
    which is worse than not offering it.
  */
  const terms = [...new Set(marks.map((mark) => mark.termName))];
  // The subject list follows the term: filtering to a term whose subjects the
  // second row still offers is a chip that answers nothing.
  const inTerm =
    term === ALL ? marks : marks.filter((m) => m.termName === term);
  const subjects = [...new Set(inTerm.map((mark) => mark.subjectName))].sort();

  const shown =
    subject === ALL
      ? inTerm
      : inTerm.filter((mark) => mark.subjectName === subject);

  return (
    <>
      <FilterChips
        value={term}
        onChange={(next) => {
          setTerm(next);
          // The subject may not exist in the new term, and a filter matching
          // nothing reads as "no marks" rather than as a stale chip.
          setSubject(ALL);
        }}
        options={[
          { value: ALL, label: t.topic.notes.allChip },
          ...terms.map((name) => ({ value: name, label: name })),
        ]}
      />

      <FilterChips
        value={subject}
        onChange={setSubject}
        options={[
          { value: ALL, label: t.topic.notes.subjectsChip },
          ...subjects.map((name) => ({ value: name, label: name })),
        ]}
      />

      <Card>
        <Stat
          value={average ?? "—"}
          label={interpolate(t.topic.notes.average, { max: outOf })}
          tone={
            average === null
              ? "default"
              : average >= passMark
                ? "success"
                : "danger"
          }
        />
      </Card>

      {shown.length === 0 ? (
        <Empty message={t.topic.notes.none} />
      ) : (
        <Card>
          {shown.map((mark, index) => (
            <View key={mark.id}>
              {index > 0 ? <Divider /> : null}
              <Row
                label={mark.subjectName}
                value={
                  mark.isAbsent
                    ? t.topic.notes.absent
                    : interpolate(t.topic.notes.score, {
                        score: mark.score ?? "—",
                        max: mark.maxScore,
                      })
                }
              />
              <Caption>
                {[
                  mark.title,
                  mark.typeName,
                  mark.termName,
                  mark.scheduledOn ? fmt.shortDate(mark.scheduledOn) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Caption>
            </View>
          ))}
        </Card>
      )}
    </>
  );
}

function Absences({ studentId }: { studentId: string }) {
  const t = useT();
  const fmt = useFormat();
  const { detail, guard } = useDetail(studentId);
  const [filter, setFilter] = useState(ALL);
  const [kind, setKind] = useState(ALL);

  if (guard) return guard;
  if (!detail.data) return null;

  const { entries, lateCount, missedCount, unjustifiedCount } =
    detail.data.attendance;

  // Justified against not is the only split that changes what a parent does:
  // an unjustified absence is a phone call to the school, a justified one is
  // already settled.
  const byJustification =
    filter === ALL
      ? entries
      : entries.filter((entry) =>
          filter === "justified" ? entry.isJustified : !entry.isJustified,
        );

  // Absence and retard are different conversations — one is a missed lesson,
  // the other is a habit — so they filter apart. See ATTENDANCE_STATUSES.
  const shown =
    kind === ALL
      ? byJustification
      : byJustification.filter((entry) => entry.status === kind);

  return (
    <>
      <Card>
        <View
          style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}
        >
          <Stat
            value={missedCount}
            label={t.topic.absences.missedSessions}
            tone={missedCount > 0 ? "warning" : "success"}
          />
          <Stat
            value={unjustifiedCount}
            label={t.topic.absences.unjustified}
            tone={unjustifiedCount > 0 ? "danger" : "success"}
          />
          <Stat
            value={lateCount}
            label={t.topic.absences.lates}
            tone={lateCount > 0 ? "warning" : "success"}
          />
        </View>
      </Card>

      <FilterChips
        value={filter}
        onChange={setFilter}
        options={[
          { value: ALL, label: t.topic.absences.allChip },
          { value: "unjustified", label: t.topic.absences.unjustifiedChip },
          { value: "justified", label: t.topic.absences.justifiedChip },
        ]}
      />

      <FilterChips
        value={kind}
        onChange={setKind}
        options={[
          { value: ALL, label: t.topic.absences.allTypesChip },
          { value: "ABSENT", label: t.topic.absences.absencesChip },
          { value: "LATE", label: t.topic.absences.latesChip },
          { value: "EXCUSED", label: t.topic.absences.excusedChip },
        ]}
      />

      {shown.length === 0 ? (
        <Empty message={t.topic.absences.none} />
      ) : (
        <Card>
          {shown.map((entry, index) => (
            <View key={entry.id}>
              {index > 0 ? <Divider /> : null}
              <Row
                label={fmt.shortDate(entry.date)}
                value={label(t.labels.absenceStatus, entry.status)}
              />
              <Caption>
                {[
                  entry.subjectName,
                  // A retard says how late, which is the whole point of it
                  // being its own status rather than a flag on "present".
                  entry.status === "LATE" && entry.minutesLate
                    ? interpolate(t.topic.absences.minutesLate, {
                        count: entry.minutesLate,
                      })
                    : null,
                  entry.isJustified
                    ? t.topic.absences.justified
                    : t.topic.absences.notJustified,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Caption>
            </View>
          ))}
        </Card>
      )}
    </>
  );
}

function Remarques({ studentId }: { studentId: string }) {
  const t = useT();
  const fmt = useFormat();
  const remarks = useChildRemarks(studentId);

  if (remarks.isPending) return <Loading />;
  if (remarks.isError) {
    return <ErrorNote message={t.topic.remarks.loadError} />;
  }
  if (remarks.data.length === 0) {
    return <Empty message={t.topic.remarks.none} />;
  }

  return (
    <Card>
      {remarks.data.map((remark, index) => (
        <View key={remark.id} style={{ gap: spacing.xs }}>
          {index > 0 ? <Divider /> : null}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <Caption>
              {[remark.subjectName, fmt.shortDate(remark.occurredOn)]
                .filter(Boolean)
                .join(" · ")}
            </Caption>
            <Badge
              tone={
                remark.tone === "POSITIVE"
                  ? "success"
                  : remark.tone === "NEGATIVE"
                    ? "danger"
                    : "default"
              }
            >
              {label(t.labels.remarkKind, remark.kind)}
            </Badge>
          </View>
          <Body>{remark.body}</Body>
          {remark.authorName ? <Caption>{remark.authorName}</Caption> : null}
        </View>
      ))}
    </Card>
  );
}

function Timetable({ studentId }: { studentId: string }) {
  const theme = useTheme();
  const t = useT();
  const timetable = useChildTimetable(studentId);

  if (timetable.isPending) return <Loading />;
  if (timetable.isError) {
    return <ErrorNote message={t.topic.timetable.loadError} />;
  }

  const { teachingDays, lessons } = timetable.data;

  if (teachingDays.length === 0) {
    return <Empty message={t.topic.timetable.none} />;
  }

  /*
    ── The same grid the web app draws ─────────────────────────────────────────
    Days down, periods across, each cell tinted with its subject's own colour at
    the same weight the desktop grid uses — a parent and the head of studies
    should be able to talk about "the blue one on Tuesday" and mean the same
    lesson.

    The days come from the school's teaching week rather than from the lessons,
    so a Wednesday with nothing on it is drawn as a free day instead of
    vanishing and leaving the reader to wonder whether the week has five days
    or six.

    It scrolls sideways with the day column pinned outside the scroll view: a
    phone cannot show six periods at a readable width, and a table whose row
    labels scroll away is a table you cannot read.
  */
  const columns = [
    ...new Map(
      lessons.map((lesson) => [
        `${lesson.startTime}-${lesson.endTime}`,
        { startTime: lesson.startTime, endTime: lesson.endTime },
      ]),
    ).values(),
  ].sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (columns.length === 0) {
    return <Empty message={t.topic.timetable.noLessonsPlaced} />;
  }

  const cellFor = (day: number, key: string) =>
    lessons.find(
      (lesson) =>
        lesson.dayOfWeek === day &&
        `${lesson.startTime}-${lesson.endTime}` === key,
    ) ?? null;

  const DAY_W = 62;
  const CELL_W = 104;
  const ROW_H = 64;

  const headerCell = {
    height: 34,
    justifyContent: "center" as const,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
  };

  return (
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
        {teachingDays.map((day) => (
          <View
            key={day}
            style={{
              height: ROW_H,
              justifyContent: "center",
              paddingHorizontal: spacing.sm,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderColor: theme.border,
            }}
          >
            <Text
              style={{ color: theme.text, fontSize: 12, fontWeight: "700" }}
            >
              {label(t.labels.weekday, String(day)).slice(0, 3)}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={{ flexDirection: "row" }}>
            {columns.map((column) => (
              <View
                key={`${column.startTime}-${column.endTime}`}
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

          {teachingDays.map((day) => (
            <View key={day} style={{ flexDirection: "row" }}>
              {columns.map((column) => {
                const key = `${column.startTime}-${column.endTime}`;
                const lesson = cellFor(day, key);
                return (
                  <View
                    key={key}
                    style={{
                      width: CELL_W,
                      height: ROW_H,
                      padding: spacing.sm,
                      justifyContent: "center",
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderLeftWidth: StyleSheet.hairlineWidth,
                      borderColor: theme.border,
                      // `22` is the same alpha the desktop grid tints with, so
                      // the two read as one colour scheme.
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
                            fontWeight: "600",
                          }}
                          numberOfLines={2}
                        >
                          {lesson.subjectShort || lesson.subjectName}
                        </Text>
                        {lesson.roomName ? (
                          <Text
                            style={{ color: theme.muted, fontSize: 10 }}
                            numberOfLines={1}
                          >
                            {lesson.roomName}
                          </Text>
                        ) : null}
                      </>
                    ) : (
                      // An empty period is drawn, not skipped: a blank cell is
                      // what tells a parent the child is free then.
                      <Text style={{ color: theme.muted, fontSize: 12 }}>
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
  );
}

function Payments({ studentId }: { studentId: string }) {
  const t = useT();
  const fmt = useFormat();
  const { detail, guard } = useDetail(studentId);
  if (guard) return guard;
  if (!detail.data) return null;

  const fees = detail.data.fees;

  /*
    ── Split by month, like the fee grid on the desktop ────────────────────────
    A year's échéancier is thirty-odd lines — scolarité, transport, cantine,
    each instalment its own row — and read as one list it is a wall. The web
    app puts the months across the top for the same reason; a phone puts them
    down the page.

    The month comes from the server (`PortalFeeLine.month`) rather than being
    sliced off the ISO date here: that string is UTC, and a due date stored at
    local midnight would file January's instalment under December.
  */
  const months = [...new Set(fees.lines.map((line) => line.month))].sort();

  return (
    <>
      <Card>
        <View
          style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}
        >
          <Stat
            value={fmt.money(fees.outstandingCentimes)}
            label={t.topic.payments.outstanding}
            tone={fees.isUpToDate ? "success" : "warning"}
          />
          <Stat
            value={fmt.money(fees.overdueCentimes)}
            label={t.topic.payments.overdue}
            tone={fees.overdueCentimes > 0 ? "danger" : "success"}
          />
          <Stat value={fmt.money(fees.paidCentimes)} label={t.topic.payments.alreadyPaid} />
        </View>
        <Badge tone={fees.isUpToDate ? "success" : "danger"}>
          {fees.isUpToDate ? t.topic.payments.upToDate : t.topic.payments.pending}
        </Badge>
      </Card>

      {fees.lines.length === 0 ? (
        <Empty message={t.topic.payments.none} />
      ) : (
        months.map((month) => {
          const lines = fees.lines.filter((line) => line.month === month);
          const due = lines.reduce(
            (total, line) => total + line.outstandingCentimes,
            0,
          );
          const settled = due === 0;

          return (
            <Card key={month}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: spacing.sm,
                }}
              >
                <Heading>{fmt.monthLabel(month)}</Heading>
                {/* The month's own balance, which is the figure a parent came
                  for — "what do I owe for March", not "what do I owe". */}
                <Badge tone={settled ? "success" : "warning"}>
                  {settled ? t.topic.payments.settled : fmt.money(due)}
                </Badge>
              </View>

              {lines.map((line, index) => (
                <View key={line.id}>
                  {index > 0 ? <Divider /> : null}
                  <Row label={line.label} value={fmt.money(line.amountCentimes)} />
                  <Caption>
                    {[
                      interpolate(t.topic.payments.due, {
                        date: fmt.shortDate(line.dueDate),
                      }),
                      line.outstandingCentimes === 0
                        ? t.topic.payments.settledTag
                        : interpolate(t.topic.payments.remaining, {
                            amount: fmt.money(line.outstandingCentimes),
                          }),
                      line.isOverdue ? t.topic.payments.overdueTag : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Caption>
                </View>
              ))}
            </Card>
          );
        })
      )}
    </>
  );
}

function DossierView({ studentId }: { studentId: string }) {
  const t = useT();
  const fmt = useFormat();
  const dossier = useChildDossier(studentId);

  if (dossier.isPending) return <Loading />;
  if (dossier.isError) {
    return <ErrorNote message={t.topic.dossier.loadError} />;
  }
  if (dossier.data.pieces.length === 0) {
    return <Empty message={t.topic.dossier.none} />;
  }

  return (
    <>
      <Card>
        <Stat
          value={interpolate(t.topic.dossier.provided, {
            provided: dossier.data.providedCount,
            required: dossier.data.requiredCount,
          })}
          label={t.topic.dossier.requiredProvided}
          tone={dossier.data.isComplete ? "success" : "warning"}
        />
        <Badge tone={dossier.data.isComplete ? "success" : "warning"}>
          {dossier.data.isComplete ? t.topic.dossier.complete : t.topic.dossier.incomplete}
        </Badge>
      </Card>

      <Card>
        {dossier.data.pieces.map((piece, index) => (
          <View key={piece.code}>
            {index > 0 ? <Divider /> : null}
            <Row
              label={piece.name}
              value={label(t.labels.documentStatus, piece.status)}
            />
            <Caption>
              {[
                piece.isRequired ? t.topic.dossier.required : t.topic.dossier.optional,
                piece.receivedOn
                  ? interpolate(t.topic.dossier.receivedOn, {
                      date: fmt.shortDate(piece.receivedOn),
                    })
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Caption>
          </View>
        ))}
      </Card>
    </>
  );
}

function Supplies({ studentId }: { studentId: string }) {
  const theme = useTheme();
  const t = useT();
  const lists = useChildSupplies(studentId);

  /*
    ── Ticked off, and kept on the phone ───────────────────────────────────────
    A parent reads this standing in a shop, so the list has to remember what is
    already in the basket — across the trip home, and across closing the app.

    Kept on the device and nowhere near the school. A tick means "I have this",
    which is a fact about the person holding the phone rather than about the
    child; two parents share one household account, so a tick sent to the
    server would tell the other one the cahiers were bought. See
    `useChecklist`.

    Keyed per child, because two children get two lists and two baskets.
  */
  const { ticked, toggle, clear, isReady } = useChecklist(
    `supplies:${studentId}`,
  );

  if (lists.isPending || !isReady) return <Loading />;
  if (lists.isError) {
    return <ErrorNote message={t.topic.supplies.loadError} />;
  }
  if (lists.data.length === 0) {
    return <Empty message={t.topic.supplies.none} />;
  }

  /*
    One card per list, because a class usually has two — the general one and
    one for arts plastiques — and running them together would leave a parent
    unable to tell which teacher asked for what.

    Optional items are marked rather than hidden: "facultatif" is the school
    saying it would be nice, and a parent who cannot see the difference buys
    everything.
  */
  const totalTicked = lists.data.reduce(
    (total, list) => total + list.items.filter((i) => ticked.has(i.id)).length,
    0,
  );

  return (
    <>
      {/* The ticks survive closing the app, so there has to be a way back to a
        clean list — next term, or after a trip that did not go to plan. Shown
        only when there is something to clear. */}
      {totalTicked > 0 ? (
        <Button
          label={interpolate(t.topic.supplies.clearAll, { count: totalTicked })}
          onPress={clear}
          variant="ghost"
        />
      ) : null}

      {lists.data.map((list) => {
        const done = list.items.filter((item) => ticked.has(item.id)).length;
        return (
          <Card key={list.id}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: spacing.sm,
              }}
            >
              <Heading>{list.subjectName ?? list.title}</Heading>
              {/* Counts up as the basket fills, and goes green when the list is
              done — the one thing somebody in a shop actually wants to know. */}
              <Badge tone={done === list.items.length ? "success" : "default"}>
                {`${done}/${list.items.length}`}
              </Badge>
            </View>

            {list.subjectName ? <Caption>{list.title}</Caption> : null}
            {list.notes ? <Body muted>{list.notes}</Body> : null}

            {list.items.map((item, index) => {
              const done = ticked.has(item.id);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => toggle(item.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: done }}
                  accessibilityLabel={item.label}
                  // The whole row is the target, not the little box: this is
                  // tapped one-handed while the other hand holds a basket.
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  {index > 0 ? <Divider /> : null}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                      paddingVertical: spacing.xs,
                    }}
                  >
                    <MaterialCommunityIcons
                      name={done ? "checkbox-marked" : "checkbox-blank-outline"}
                      size={20}
                      color={done ? theme.success : theme.muted}
                    />
                    <Text
                      style={{
                        color: done ? theme.muted : theme.text,
                        flex: 1,
                        fontSize: 14,
                        textDecorationLine: done ? "line-through" : "none",
                      }}
                      numberOfLines={2}
                    >
                      {item.label}
                    </Text>
                    {item.quantity ? (
                      <Text
                        style={{
                          color: theme.muted,
                          fontSize: 13,
                          fontWeight: "700",
                        }}
                      >
                        ×{item.quantity}
                      </Text>
                    ) : null}
                  </View>

                  {item.notes || !item.isRequired ? (
                    <Caption>
                      {[item.notes, item.isRequired ? null : t.topic.supplies.optional]
                        .filter(Boolean)
                        .join(" · ")}
                    </Caption>
                  ) : null}
                </Pressable>
              );
            })}
          </Card>
        );
      })}
    </>
  );
}

function Transport({ studentId }: { studentId: string }) {
  const t = useT();
  const { detail, guard } = useDetail(studentId);
  if (guard) return guard;
  if (!detail.data) return null;

  const transport = detail.data.transport;
  if (!transport) {
    return <Empty message={t.topic.transport.notEnrolled} />;
  }

  return (
    <Card>
      <Heading>{transport.routeName}</Heading>
      <Row label={t.topic.transport.stop} value={transport.stopName} />
      <Divider />
      <Row label={t.topic.transport.direction} value={label(t.labels.direction, transport.direction)} />
    </Card>
  );
}

function Events() {
  const t = useT();
  const fmt = useFormat();
  const events = useEvents();

  if (events.isPending) return <Loading />;
  if (events.isError) {
    return <ErrorNote message={t.topic.events.loadError} />;
  }
  if (events.data.length === 0) {
    return <Empty message={t.topic.events.none} />;
  }

  return (
    <Card>
      {events.data.map((event, index) => (
        <View key={event.id} style={{ gap: spacing.xs }}>
          {index > 0 ? <Divider /> : null}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <Heading>{event.title}</Heading>
            {event.status === "CANCELLED" ? (
              <Badge tone="danger">{t.topic.events.cancelled}</Badge>
            ) : (
              <Badge>{label(t.labels.eventKind, event.kind)}</Badge>
            )}
          </View>

          <Caption>
            {/* All-day events print the date alone: their `startsAt` is snapped
              to midnight, and rendering that as 00:00 is exactly what the flag
              exists to prevent. */}
            {event.isAllDay
              ? fmt.shortDate(event.startsAt)
              : `${fmt.shortDate(event.startsAt)} · ${event.startsAt.slice(11, 16)}`}
            {event.location ? ` · ${event.location}` : ""}
          </Caption>

          {event.description ? <Body muted>{event.description}</Body> : null}
        </View>
      ))}
    </Card>
  );
}
