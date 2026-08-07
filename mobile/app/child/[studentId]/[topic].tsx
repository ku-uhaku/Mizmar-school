import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useChild,
  useChildDossier,
  useChildRemarks,
  useChildTimetable,
  useEvents,
} from "../../../src/api/hooks";
import {
  Badge,
  Body,
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
import {
  ATTENDANCE_LABELS,
  DIRECTION_LABELS,
  DOCUMENT_STATUS_LABELS,
  EVENT_KIND_LABELS,
  WEEKDAY_LABELS,
  label,
  money,
  shortDate,
} from "../../../src/ui/format";
import { radius, spacing, useTheme } from "../../../src/ui/theme";

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

const TITLES: Record<string, string> = {
  notes: "Notes",
  absences: "Absences",
  remarques: "Remarques",
  "emploi-du-temps": "Emploi du temps",
  paiements: "Paiements",
  dossier: "Dossier",
  transport: "Transport",
  evenements: "Événements",
};

export default function TopicScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { studentId, topic } = useLocalSearchParams<{
    studentId: string;
    topic: string;
  }>();

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: TITLES[topic] ?? "Détail" }}
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
    case "transport":
      return <Transport studentId={studentId} />;
    case "evenements":
      return <Events />;
    default:
      return <Empty message="Rien à afficher." />;
  }
}

/** The four topics that come off the child's own detail read. */
function useDetail(studentId: string) {
  const detail = useChild(studentId);
  return {
    detail,
    guard: detail.isPending ? (
      <Loading />
    ) : detail.isError ? (
      <ErrorNote message="Impossible de charger la fiche de l'élève." />
    ) : null,
  };
}

function Notes({ studentId }: { studentId: string }) {
  const { detail, guard } = useDetail(studentId);
  // Declared before the early returns: a hook may not be called conditionally,
  // and the guard above returns.
  const [term, setTerm] = useState(ALL);

  if (guard) return guard;
  if (!detail.data) return null;

  const { marks, averageOutOf20 } = detail.data.marks;

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
  const shown = term === ALL ? marks : marks.filter((m) => m.termName === term);

  return (
    <>
      <FilterChips
        value={term}
        onChange={setTerm}
        options={[
          { value: ALL, label: "Tous" },
          ...terms.map((name) => ({ value: name, label: name })),
        ]}
      />

      <Card>
        <Stat
          value={averageOutOf20 ?? "—"}
          label="Moyenne générale /20"
          tone={
            averageOutOf20 === null
              ? "default"
              : averageOutOf20 >= 10
                ? "success"
                : "danger"
          }
        />
      </Card>

      {shown.length === 0 ? (
        <Empty message="Aucune note publiée pour le moment." />
      ) : (
        <Card>
          {shown.map((mark, index) => (
            <View key={mark.id}>
              {index > 0 ? <Divider /> : null}
              <Row
                label={mark.subjectName}
                value={
                  mark.isAbsent ? "Absent" : `${mark.score ?? "—"}/${mark.maxScore}`
                }
              />
              <Caption>
                {[
                  mark.title,
                  mark.typeName,
                  mark.termName,
                  mark.scheduledOn ? shortDate(mark.scheduledOn) : null,
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
  const { detail, guard } = useDetail(studentId);
  const [filter, setFilter] = useState(ALL);

  if (guard) return guard;
  if (!detail.data) return null;

  const { entries, missedCount, unjustifiedCount } = detail.data.attendance;

  // Justified against not is the only split that changes what a parent does:
  // an unjustified absence is a phone call to the school, a justified one is
  // already settled.
  const shown =
    filter === ALL
      ? entries
      : entries.filter((entry) =>
          filter === "justified" ? entry.isJustified : !entry.isJustified,
        );

  return (
    <>
      <Card>
        <View
          style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}
        >
          <Stat
            value={missedCount}
            label="Séances manquées"
            tone={missedCount > 0 ? "warning" : "success"}
          />
          <Stat
            value={unjustifiedCount}
            label="Non justifiées"
            tone={unjustifiedCount > 0 ? "danger" : "success"}
          />
        </View>
      </Card>

      <FilterChips
        value={filter}
        onChange={setFilter}
        options={[
          { value: ALL, label: "Toutes" },
          { value: "unjustified", label: "Non justifiées" },
          { value: "justified", label: "Justifiées" },
        ]}
      />

      {shown.length === 0 ? (
        <Empty message="Aucune absence enregistrée." />
      ) : (
        <Card>
          {shown.map((entry, index) => (
            <View key={entry.id}>
              {index > 0 ? <Divider /> : null}
              <Row
                label={shortDate(entry.date)}
                value={label(ATTENDANCE_LABELS, entry.status)}
              />
              <Caption>
                {[
                  entry.subjectName,
                  entry.isJustified ? "Justifiée" : "Non justifiée",
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
  const remarks = useChildRemarks(studentId);

  if (remarks.isPending) return <Loading />;
  if (remarks.isError) {
    return <ErrorNote message="Impossible de charger les remarques." />;
  }
  if (remarks.data.length === 0) {
    return <Empty message="Aucune remarque partagée par les enseignants." />;
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
              {[remark.subjectName, shortDate(remark.occurredOn)]
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
              {remark.kind}
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
  const lessons = useChildTimetable(studentId);

  if (lessons.isPending) return <Loading />;
  if (lessons.isError) {
    return <ErrorNote message="Impossible de charger l'emploi du temps." />;
  }
  if (lessons.data.length === 0) {
    return (
      <Empty message="Aucun emploi du temps — l'élève n'a pas encore de classe." />
    );
  }

  /*
    ── The same grid the web app draws ─────────────────────────────────────────
    Days down, periods across — a parent comparing "what does Tuesday look
    like" against Wednesday reads a table, not eight stacked day cards. The
    columns are derived here rather than sent: the API returns the week in
    order, and the distinct (start, end) pairs *are* the columns, so shipping
    them separately would be shipping the same fact twice.

    It scrolls sideways with the day column pinned outside the scroll view,
    because a phone cannot show six periods at a readable width and a table
    whose row labels scroll away is a table you cannot read.
  */
  const columns = [
    ...new Map(
      lessons.data.map((lesson) => [
        `${lesson.startTime}-${lesson.endTime}`,
        { startTime: lesson.startTime, endTime: lesson.endTime },
      ]),
    ).values(),
  ].sort((a, b) => a.startTime.localeCompare(b.startTime));

  const days = [...new Set(lessons.data.map((lesson) => lesson.dayOfWeek))].sort(
    (a, b) => a - b,
  );

  const cellFor = (day: number, key: string) =>
    lessons.data.find(
      (lesson) => lesson.dayOfWeek === day && `${lesson.startTime}-${lesson.endTime}` === key,
    ) ?? null;

  const DAY_W = 74;
  const CELL_W = 104;
  const ROW_H = 62;

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
      {/* The day column, outside the scroll view so it stays put. */}
      <View style={{ width: DAY_W, borderRightWidth: StyleSheet.hairlineWidth, borderColor: theme.border }}>
        <View style={headerCell} />
        {days.map((day) => (
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
            <Text style={{ color: theme.text, fontSize: 12, fontWeight: "700" }}>
              {label(WEEKDAY_LABELS, String(day)).slice(0, 3)}
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
                <Text style={{ color: theme.muted, fontSize: 11, fontWeight: "600" }}>
                  {column.startTime}
                </Text>
              </View>
            ))}
          </View>

          {days.map((day) => (
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
                    }}
                  >
                    {lesson ? (
                      <>
                        <Text
                          style={{ color: theme.text, fontSize: 12, fontWeight: "600" }}
                          numberOfLines={2}
                        >
                          {lesson.subjectName}
                        </Text>
                        {lesson.roomName ? (
                          <Text style={{ color: theme.muted, fontSize: 10 }} numberOfLines={1}>
                            {lesson.roomName}
                          </Text>
                        ) : null}
                      </>
                    ) : (
                      // An empty period is drawn, not skipped: a blank cell is
                      // what tells a parent the child is free then.
                      <Text style={{ color: theme.muted, fontSize: 12 }}>—</Text>
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
  const { detail, guard } = useDetail(studentId);
  if (guard) return guard;
  if (!detail.data) return null;

  const fees = detail.data.fees;

  return (
    <>
      <Card>
        <View
          style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}
        >
          <Stat
            value={money(fees.outstandingCentimes)}
            label="Reste à payer"
            tone={fees.isUpToDate ? "success" : "warning"}
          />
          <Stat
            value={money(fees.overdueCentimes)}
            label="En retard"
            tone={fees.overdueCentimes > 0 ? "danger" : "success"}
          />
          <Stat value={money(fees.paidCentimes)} label="Déjà réglé" />
        </View>
        <Badge tone={fees.isUpToDate ? "success" : "danger"}>
          {fees.isUpToDate ? "À jour" : "Paiement en attente"}
        </Badge>
      </Card>

      {fees.lines.length === 0 ? (
        <Empty message="Aucune échéance." />
      ) : (
        <Card>
          {fees.lines.map((line, index) => (
            <View key={line.id}>
              {index > 0 ? <Divider /> : null}
              <Row label={line.label} value={money(line.amountCentimes)} />
              <Caption>
                {[
                  shortDate(line.dueDate),
                  line.outstandingCentimes === 0
                    ? "Réglée"
                    : `${money(line.outstandingCentimes)} restant`,
                  line.isOverdue ? "En retard" : null,
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

function DossierView({ studentId }: { studentId: string }) {
  const dossier = useChildDossier(studentId);

  if (dossier.isPending) return <Loading />;
  if (dossier.isError) {
    return <ErrorNote message="Impossible de charger le dossier." />;
  }
  if (dossier.data.pieces.length === 0) {
    return <Empty message="Aucune pièce demandée par l'école." />;
  }

  return (
    <>
      <Card>
        <Stat
          value={`${dossier.data.providedCount}/${dossier.data.requiredCount}`}
          label="Pièces obligatoires fournies"
          tone={dossier.data.isComplete ? "success" : "warning"}
        />
        <Badge tone={dossier.data.isComplete ? "success" : "warning"}>
          {dossier.data.isComplete ? "Dossier complet" : "Dossier incomplet"}
        </Badge>
      </Card>

      <Card>
        {dossier.data.pieces.map((piece, index) => (
          <View key={piece.code}>
            {index > 0 ? <Divider /> : null}
            <Row
              label={piece.name}
              value={label(DOCUMENT_STATUS_LABELS, piece.status)}
            />
            <Caption>
              {[
                piece.isRequired ? "Obligatoire" : "Facultative",
                piece.receivedOn ? `Reçue le ${shortDate(piece.receivedOn)}` : null,
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

function Transport({ studentId }: { studentId: string }) {
  const { detail, guard } = useDetail(studentId);
  if (guard) return guard;
  if (!detail.data) return null;

  const transport = detail.data.transport;
  if (!transport) {
    return <Empty message="Cet élève n'est pas inscrit au transport." />;
  }

  return (
    <Card>
      <Heading>{transport.routeName}</Heading>
      <Row label="Arrêt" value={transport.stopName} />
      <Divider />
      <Row
        label="Sens"
        value={label(DIRECTION_LABELS, transport.direction)}
      />
    </Card>
  );
}

function Events() {
  const events = useEvents();

  if (events.isPending) return <Loading />;
  if (events.isError) {
    return <ErrorNote message="Impossible de charger les événements." />;
  }
  if (events.data.length === 0) {
    return <Empty message="Rien d'annoncé pour le moment." />;
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
              <Badge tone="danger">Annulé</Badge>
            ) : (
              <Badge>{label(EVENT_KIND_LABELS, event.kind)}</Badge>
            )}
          </View>

          <Caption>
            {/* All-day events print the date alone: their `startsAt` is snapped
              to midnight, and rendering that as 00:00 is exactly what the flag
              exists to prevent. */}
            {event.isAllDay
              ? shortDate(event.startsAt)
              : `${shortDate(event.startsAt)} · ${event.startsAt.slice(11, 16)}`}
            {event.location ? ` · ${event.location}` : ""}
          </Caption>

          {event.description ? <Body muted>{event.description}</Body> : null}
        </View>
      ))}
    </Card>
  );
}
