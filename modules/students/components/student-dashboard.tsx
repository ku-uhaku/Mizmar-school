"use client";

import Link from "next/link";
import * as React from "react";
import {
  BanknoteIcon,
  CalendarCheckIcon,
  FolderCheckIcon,
  GraduationCapIcon,
  MessageSquareWarningIcon,
  PhoneIcon,
  UsersIcon,
} from "lucide-react";

import { ColumnChart } from "@/components/charts/column-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { RadialGauge } from "@/components/charts/radial-gauge";
import { SplitBar } from "@/components/charts/split-bar";
import { StatTile } from "@/components/charts/stat-tile";
import { TrendChart, type TrendPoint } from "@/components/charts/trend-chart";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSettings } from "@/components/providers/settings-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  formatDate,
  formatMonth,
  formatMoney,
  interpolate,
} from "@/lib/i18n/format";
import { ageFrom, cn } from "@/lib/utils";
import type { PupilMarks } from "@/modules/assessments/queries";
import type {
  PupilAttendance,
  PupilRemarkRow,
} from "@/modules/classroom/queries";
import type { StudentDossier } from "@/modules/documents/queries";
import type { EnrolmentDetail } from "@/modules/enrolment/queries";
import type { GuardianRow } from "@/modules/families/queries";
import type { PupilTeacherRow } from "@/modules/classes/queries";
import type { StudentDetail } from "@/modules/students/queries";
import type { PaymentStanding } from "@/modules/treasury/queries";

/**
 * The pupil's year on one screen: who they are, how they are doing, whether
 * they turn up, what the family owes, and what anybody has said about them.
 *
 * ── Why each form was chosen ────────────────────────────────────────────────
 * The form follows the job of the data, never the wish for variety:
 *
 *   · **Assiduité** — one rate out of a known whole, so a radial gauge: the arc
 *     *is* the proportion.
 *   · **Le registre** — identity across four states, few enough to read as a
 *     ring, so a donut.
 *   · **La scolarité** — réglé against reste and échu is the same question
 *     shape, so deliberately the same donut; the per-charge breakdown under it
 *     is a split bar, because that is part-to-whole *within each row*.
 *   · **Les moyennes par matière** — magnitudes across many categories, so
 *     columns. Never a pie: nobody can compare fifteen angles.
 *
 * Everything comes from `components/charts`, which already carries this app's
 * validated palette, its surface gaps and its table fallbacks. A second chart
 * vocabulary on one screen would be two visual languages.
 *
 * ── Why the marks are a table *as well* ─────────────────────────────────────
 * A column chart answers "which subject is weak". It cannot answer "what did
 * she get on the contrôle n°2", which is what a parent asks on the telephone —
 * so the chart and the table sit together and neither replaces the other.
 */
export function StudentDashboard({
  student,
  enrolment,
  guardians,
  familyName,
  marks,
  attendance,
  remarks,
  standing,
  dossier,
  teachers,
}: {
  student: StudentDetail;
  enrolment: EnrolmentDetail | null;
  guardians: GuardianRow[];
  familyName: string | null;
  marks: PupilMarks | null;
  attendance: PupilAttendance | null;
  remarks: PupilRemarkRow[] | null;
  /** Null when the reader may not see money — the card is absent, not empty. */
  standing: PaymentStanding | null;
  /** Null when the reader may not see the dossier. */
  dossier: StudentDossier | null;
  /** Null when the pupil holds no place this year — see the page. */
  teachers: PupilTeacherRow[] | null;
}) {
  const { t, locale } = useI18n();
  const { currencyCode: currency } = useSettings();

  const money = (centimes: number) => formatMoney(centimes, locale, currency);

  /*
    Every counted paper, in the order it was sat, normalised onto the school's
    scale so a test out of 10 is not plotted at half the height of one out of 20.

    Derived here rather than added to `loadPupilMarks`: the query's job is the
    averages, and this is the same rows read a second way. Absences are dropped
    rather than plotted as nought — a child who was not there did not score
    nought, which is the rule the averages already follow.
  */
  const markTrend = React.useMemo<TrendPoint[]>(() => {
    if (!marks) return [];
    const outOf = marks.outOf;

    return marks.subjects
      .flatMap((subject) =>
        subject.marks
          .filter(
            (mark) =>
              mark.counts &&
              !mark.isAbsent &&
              mark.score !== null &&
              mark.scheduledOn !== null,
          )
          .map((mark) => ({
            on: mark.scheduledOn as string,
            // The paper's own title, not just its kind: "Contrôle continu" is
            // the same words for the first of the term and the third, and a
            // point a reader cannot tell from the one beside it is not a label.
            label: `${subject.subjectName} · ${mark.title}`,
            // Onto the school's scale, exactly as the averages are.
            value:
              Math.round(((mark.score as number) / mark.maxScore) * outOf * 10) /
              10,
          })),
      )
      .sort((a, b) => a.on.localeCompare(b.on))
      .map((point) => ({ label: point.label, value: point.value }));
  }, [marks]);

  /*
    The attendance rate month by month, on the same definition the headline
    figure uses: present or late, over what was actually marked. A single
    percentage says whether a child turns up; this says whether that changed in
    February, which is the question a head of studies is actually asking.
  */
  const attendanceTrend = React.useMemo<TrendPoint[]>(() => {
    if (!attendance) return [];

    const byMonth = new Map<string, { here: number; marked: number }>();
    for (const row of attendance.rows) {
      const key = row.date.slice(0, 7); // `YYYY-MM`
      const held = byMonth.get(key) ?? { here: 0, marked: 0 };
      held.marked += 1;
      if (row.status === "PRESENT" || row.status === "LATE") held.here += 1;
      byMonth.set(key, held);
    }

    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      /*
        A month nobody really marked is not a month the child was away.

        With one or two registers taken — the week a term ends, say — a single
        absence reads as 0% and the line plunges off a cliff that never
        happened. That is the same trap `attendanceRate` avoids by excluding
        days nobody marked; a monthly figure needs the rule applied a second
        time, to the month itself.
      */
      .filter(([, tally]) => tally.marked >= 3)
      .map(([key, tally]) => {
        const [year, month] = key.split("-").map(Number);
        return {
          label: formatMonth(year, month, locale),
          value: Math.round((tally.here / tally.marked) * 100),
        };
      });
  }, [attendance, locale]);

  return (
    <div className="grid gap-5">
      <IdentityCard
        student={student}
        enrolment={enrolment}
        familyName={familyName}
        guardians={guardians}
      />

      {/* The four headline figures. Numbers first, charts under them: somebody
        who wants only the average should not have to read a ring for it. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={t.assessment.overallAverage}
          value={marks?.overall ?? 0}
          suffix={` / ${marks?.outOf ?? 20}`}
          detail={
            marks && marks.markedCount > 0
              ? interpolate(t.assessment.marksCounted, {
                  count: marks.markedCount,
                })
              : t.assessment.noMarksYet
          }
          icon={<GraduationCapIcon className="size-4" />}
          locale={locale}
        />
        <StatTile
          label={t.classroom.attendanceRate}
          value={attendance?.attendanceRate ?? 0}
          suffix="%"
          detail={
            attendance && attendance.unjustifiedAbsences > 0
              ? interpolate(t.classroom.unjustifiedCount, {
                  count: attendance.unjustifiedAbsences,
                })
              : t.classroom.ofMarkedDays
          }
          icon={<CalendarCheckIcon className="size-4" />}
          locale={locale}
        />
        {standing ? (
          <StatTile
            label={t.treasury.outstanding}
            value={standing.outstandingCentimes / 100}
            suffix={` ${currency}`}
            detail={
              standing.overdueCentimes > 0
                ? `${t.treasury.overdue} · ${money(standing.overdueCentimes)}`
                : t.student.steps.PAYMENT
            }
            icon={<BanknoteIcon className="size-4" />}
            locale={locale}
          />
        ) : null}
        {dossier ? (
          <StatTile
            label={t.document.dossier}
            value={dossier.standing.settledRequired}
            suffix={` / ${dossier.standing.totalRequired}`}
            detail={
              dossier.standing.isComplete
                ? t.document.complete
                : interpolate(t.document.missingCount, {
                    count: dossier.standing.missingRequired,
                  })
            }
            icon={<FolderCheckIcon className="size-4" />}
            locale={locale}
          />
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {attendance?.attendanceRate != null ? (
          <Panel title={t.classroom.attendanceRate}>
            <RadialGauge
              value={attendance.attendanceRate}
              label={t.classroom.attendanceRate}
              caption={t.classroom.ofMarkedDays}
            />
          </Panel>
        ) : null}

        {attendance && attendance.rows.length > 0 ? (
          <Panel title={t.student.tabAttendance}>
            <DonutChart
              slices={[
                {
                  label: t.classroomOptions.attendanceStatuses.PRESENT,
                  value: attendance.tally.present,
                },
                {
                  label: t.classroomOptions.attendanceStatuses.LATE,
                  value: attendance.tally.late,
                },
                {
                  label: t.classroomOptions.attendanceStatuses.ABSENT,
                  value: attendance.tally.absent,
                },
                {
                  label: t.classroomOptions.attendanceStatuses.EXCUSED,
                  value: attendance.tally.excused,
                },
              ]}
              total={attendance.rows.length}
              totalLabel={t.classroom.ofMarkedDays}
              tableCaption={t.student.tabAttendance}
              categoryLabel={t.classroom.attendanceStatus}
            />
          </Panel>
        ) : null}

        {standing && standing.chargedCentimes > 0 ? (
          <Panel title={t.student.tabPayment}>
            <DonutChart
              slices={[
                {
                  label: t.treasury.collected,
                  value: Math.round(standing.paidCentimes / 100),
                },
                {
                  label: t.treasury.outstanding,
                  value: Math.round(
                    (standing.outstandingCentimes - standing.overdueCentimes) /
                      100,
                  ),
                },
                {
                  label: t.treasury.overdue,
                  value: Math.round(standing.overdueCentimes / 100),
                },
              ]}
              total={Math.round(standing.chargedCentimes / 100)}
              totalLabel={currency}
              tableCaption={t.student.tabPayment}
              categoryLabel={t.treasury.standing}
            />
          </Panel>
        ) : null}
      </div>

      {marks && marks.subjects.some((subject) => subject.average !== null) ? (
        <Panel title={t.student.tabMarks}>
          <ColumnChart
            columns={marks.subjects
              .filter((subject) => subject.average !== null)
              .map((subject) => ({
                label: subject.subjectName,
                value: subject.average as number,
              }))}
            unitLabel={`/ ${marks.outOf}`}
            tableCaption={t.student.tabMarks}
            categoryLabel={t.assessment.subject}
          />
        </Panel>
      ) : null}

      {/* Two lines, because both questions are "did this change, and when".
        A column chart answers "which subject is weak"; neither of these can be
        read off it, and a shape over time is what a line is for. */}
      <div className="grid gap-4 lg:grid-cols-2">
        {markTrend.length > 1 ? (
          <Panel title={t.student.marksTrend} hint={t.student.marksTrendHint}>
            <TrendChart
              points={markTrend}
              unitLabel={`/ ${marks?.outOf ?? 20}`}
              tableCaption={t.student.marksTrend}
              periodLabel={t.student.paper}
              zeroBaseline
            />
          </Panel>
        ) : null}

        {attendanceTrend.length > 1 ? (
          <Panel
            title={t.student.attendanceByMonth}
            hint={t.student.attendanceByMonthHint}
          >
            <TrendChart
              points={attendanceTrend}
              unitLabel="%"
              tableCaption={t.student.attendanceByMonth}
              periodLabel={t.student.month}
              zeroBaseline
            />
          </Panel>
        ) : null}
      </div>

      {/* Les frais, charge by charge. A split bar per row rather than five more
        rings: this is part-to-whole *within each line*, and five donuts would be
        five things to compare instead of one column to read down. */}
      {standing && standing.byService.length > 0 ? (
        <Panel title={t.student.tabFees}>
          <ul className="grid gap-3">
            {standing.byService.map((service) => (
              <li key={service.feeTypeId} className="grid gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{service.feeTypeName}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {money(service.paidCentimes)} /{" "}
                    {money(service.chargedCentimes)}
                    {service.overdueCentimes > 0 ? (
                      <span className="text-destructive ms-2">
                        {t.treasury.overdue} {money(service.overdueCentimes)}
                      </span>
                    ) : null}
                  </span>
                </div>
                <SplitBar
                  segments={[
                    { label: t.treasury.collected, value: service.paidCentimes },
                    {
                      label: t.treasury.outstanding,
                      value: Math.max(
                        0,
                        service.outstandingCentimes - service.overdueCentimes,
                      ),
                    },
                    {
                      label: t.treasury.overdue,
                      value: service.overdueCentimes,
                    },
                  ]}
                />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {/* Who teaches them. A table, not cards: it is a directory — read down one
        column to find a subject, across one row to find the person. */}
      {teachers ? (
        <Panel title={t.student.teachers} hint={t.student.teachersHint}>
          {teachers.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              {/* Not seated yet is the common case here, and the one somebody
                  has to act on — see the note on the page. */}
              {enrolment?.schoolClassId
                ? t.student.noTeachers
                : t.enrolment.noClass}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-xs">
                    <th className="py-1.5 text-start font-medium">
                      {t.assessment.subject}
                    </th>
                    <th className="py-1.5 text-start font-medium">
                      {t.schoolClass.teacher}
                    </th>
                    <th className="hidden py-1.5 text-start font-medium sm:table-cell">
                      {t.hr.email}
                    </th>
                    <th className="py-1.5 text-end font-medium">
                      {t.schoolClass.weeklyMinutes}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((row) => (
                    <tr
                      key={row.assignmentId}
                      className="border-b last:border-b-0"
                    >
                      <td className="py-1.5 pe-2">
                        <span className="font-medium">{row.subjectName}</span>
                        {row.groupLabel ? (
                          <span className="text-muted-foreground ms-2 text-xs">
                            {row.groupLabel}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-1.5 pe-2">
                        {row.teacherName}
                        {/* Which of two co-teachers answers for the marks. */}
                        {row.isPrimary ? (
                          <Badge
                            variant="secondary"
                            className="ms-2 text-[10px]"
                          >
                            {t.schoolClass.primaryBadge}
                          </Badge>
                        ) : null}
                      </td>
                      <td
                        className="text-muted-foreground hidden py-1.5 pe-2 text-xs sm:table-cell"
                        dir="ltr"
                      >
                        <a
                          href={`mailto:${row.teacherEmail}`}
                          className="hover:underline"
                        >
                          {row.teacherEmail}
                        </a>
                      </td>
                      <td className="py-1.5 text-end tabular-nums">
                        {row.weeklyMinutes ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Every counted paper, not the three most recent per subject: this is
          the table a parent reads down the telephone, and a silent cut at three
          made a subject with four contrôles look like it had three. */}
        {marks && marks.markedCount > 0 ? (
          <Panel title={t.student.allMarks}>
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-card sticky top-0">
                  <tr className="text-muted-foreground border-b text-xs">
                    <th className="py-1.5 text-start font-medium">
                      {t.assessment.subject}
                    </th>
                    <th className="py-1.5 text-start font-medium">
                      {t.assessment.kind}
                    </th>
                    <th className="hidden py-1.5 text-start font-medium sm:table-cell">
                      {t.assessment.scheduledOn}
                    </th>
                    <th className="py-1.5 text-end font-medium">
                      {t.assessment.score}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {marks.subjects.flatMap((subject) =>
                    subject.marks.map((mark) => (
                      <tr key={mark.id} className="border-b last:border-b-0">
                        <td className="py-1.5 pe-2">{subject.subjectName}</td>
                        <td className="text-muted-foreground py-1.5 pe-2 text-xs">
                          {mark.typeName}
                        </td>
                        <td
                          className="text-muted-foreground hidden py-1.5 pe-2 text-xs sm:table-cell"
                          dir="ltr"
                        >
                          {mark.scheduledOn
                            ? formatDate(new Date(mark.scheduledOn), locale)
                            : "—"}
                        </td>
                        <td
                          className={cn(
                            "py-1.5 text-end tabular-nums",
                            mark.isAbsent && "text-muted-foreground",
                            !mark.isAbsent &&
                              mark.score !== null &&
                              (mark.score >= mark.maxScore / 2
                                ? "text-success font-medium"
                                : "text-destructive font-medium"),
                          )}
                        >
                          {mark.isAbsent
                            ? t.assessment.absent
                            : mark.score === null
                              ? "—"
                              : `${mark.score} / ${mark.maxScore}`}
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : null}

        {/* What teachers have raised — the thing a head of studies opens a
          pupil's file to find. All of them, scrolled, rather than the six most
          recent: "has this happened before" is the question being asked. */}
        {remarks ? (
          <Panel title={t.classroom.remarks}>
            {remarks.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                {t.student.noRemarks}
              </p>
            ) : (
              <ul className="grid max-h-96 gap-3 overflow-auto">
                {remarks.map((remark) => (
                  <li key={remark.id} className="grid gap-0.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline" className="text-[10px]">
                        {t.classroomOptions.remarkKinds[
                          remark.kind as keyof typeof t.classroomOptions.remarkKinds
                        ] ?? remark.kind}
                      </Badge>
                      <span className="text-muted-foreground" dir="ltr">
                        {formatDate(new Date(remark.occurredOn), locale)}
                      </span>
                      {remark.subjectName ? (
                        <span className="text-muted-foreground truncate">
                          {remark.subjectName}
                        </span>
                      ) : null}
                      {remark.isVisibleToFamily ? (
                        <MessageSquareWarningIcon className="text-warning size-3" />
                      ) : null}
                    </div>
                    <p className="text-sm text-pretty">{remark.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Who the child is, with their photograph.
 *
 * At the top because every other figure on the page is about *this* person, and
 * a dashboard that opens on a percentage makes you scroll back to check whose it
 * is. The guardian's telephone is here for the same reason it is the first thing
 * a secretary reaches for.
 */
function IdentityCard({
  student,
  enrolment,
  familyName,
  guardians,
}: {
  student: StudentDetail;
  enrolment: EnrolmentDetail | null;
  familyName: string | null;
  guardians: GuardianRow[];
}) {
  const { t, locale } = useI18n();
  const age = ageFrom(student.birthDate);
  const primary =
    guardians.find((guardian) => guardian.isPrimaryContact) ?? guardians[0];

  return (
    <section className="bg-card ring-foreground/10 grid gap-4 rounded-xl p-4 ring-1 sm:grid-cols-[auto_1fr_auto]">
      <Avatar className="size-20 border">
        {student.photoUrl ? <AvatarImage src={student.photoUrl} alt="" /> : null}
        <AvatarFallback className="text-lg">
          {`${student.firstName[0] ?? ""}${student.lastName[0] ?? ""}`.toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0">
        <h2 className="truncate text-lg font-semibold">
          {student.firstName} {student.lastName}
        </h2>
        {student.firstNameAr || student.lastNameAr ? (
          <p className="text-muted-foreground truncate text-sm" dir="rtl">
            {`${student.lastNameAr ?? ""} ${student.firstNameAr ?? ""}`.trim()}
          </p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="tabular-nums">
            {student.code}
          </Badge>
          {enrolment?.className ? (
            <Badge variant="section">{enrolment.className}</Badge>
          ) : null}
          {enrolment?.levelName ? (
            <Badge variant="section">{enrolment.levelName}</Badge>
          ) : null}
        </div>

        <dl className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <Fact
            label={t.student.birthDate}
            value={`${formatDate(new Date(student.birthDate), locale)}${
              age === null ? "" : ` · ${age}`
            }`}
          />
          <Fact
            label={t.student.gender}
            value={
              t.studentOptions.genders[
                student.gender as keyof typeof t.studentOptions.genders
              ]
            }
          />
        </dl>
      </div>

      {/* The household, and the number somebody will actually dial. */}
      <div className="text-muted-foreground grid content-start gap-1 text-xs sm:text-end">
        {familyName && student.familyId ? (
          <Link
            href={`/families/${student.familyId}`}
            className="hover:text-foreground flex items-center gap-1.5 sm:justify-end"
          >
            <UsersIcon className="size-3.5" />
            <span className="truncate">{familyName}</span>
          </Link>
        ) : null}
        {primary ? (
          <>
            <span className="truncate">
              {primary.firstName} {primary.lastName}
            </span>
            {primary.phone ? (
              <a
                href={`tel:${primary.phone}`}
                className="hover:text-foreground flex items-center gap-1.5 sm:justify-end"
                dir="ltr"
              >
                <PhoneIcon className="size-3.5" />
                {primary.phone}
              </a>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1">
      <dt>{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

/** A titled surface. The charts carry their own legends and table fallbacks. */
function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  /** One line under the heading, where the chart needs saying what it counts. */
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card ring-foreground/10 rounded-xl p-4 ring-1">
      <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {title}
      </h2>
      {hint ? (
        <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>
      ) : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}
