import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintDocument } from "@/components/print/print-document";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { formatDate, formatMoney, interpolate } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { letterheadFrom } from "@/lib/letterhead";
import { PERMISSIONS } from "@/lib/permissions";
import { loadPupilMarks } from "@/modules/assessments/queries";
import {
  loadPupilAttendance,
  loadPupilRemarks,
} from "@/modules/classroom/queries";
import { loadStudentDossier } from "@/modules/documents/queries";
import { findEnrolment } from "@/modules/enrolment/queries";
import { findFamily } from "@/modules/families/queries";
import { findStudent } from "@/modules/students/queries";
import { studentPaymentStanding } from "@/modules/treasury/queries";

export const metadata: Metadata = { title: "Fiche de situation" };

/**
 * La fiche de situation: everything the school knows about one pupil, on paper.
 *
 * ── Why it is not the dashboard printed ─────────────────────────────────────
 * The screen is charts, and a ring is the wrong way to hand somebody a figure
 * they will read once and file. On paper the same facts become tables — an
 * average per subject, a tally of absences, a charge-by-charge échéancier —
 * because that is what survives a photocopier and what a parent can be walked
 * through line by line.
 *
 * The browser's print dialog is the PDF: it lays out Arabic shaped and
 * right-to-left, which is exactly the part a PDF library charges a lot of work
 * for. See PrintDocument.
 */
export default async function StudentSituationPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const context = await requireAuth();
  const t = await getDictionary();
  const locale = await getLocale();

  if (!context.can(PERMISSIONS.STUDENT_VIEW)) {
    return <ForbiddenState />;
  }

  const student = await findStudent(context, studentId);
  if (!student) notFound();

  const canSeeMoney = context.can(PERMISSIONS.TREASURY_VIEW);
  const enrolment = await findEnrolment(context, student.id);

  const [marks, attendance, remarks, standing, dossier, family] =
    await Promise.all([
      enrolment ? loadPupilMarks(context, enrolment.id) : null,
      enrolment ? loadPupilAttendance(context, enrolment.id) : null,
      enrolment && context.can(PERMISSIONS.CLASSROOM_REMARK_VIEW)
        ? loadPupilRemarks(context, enrolment.id)
        : null,
      canSeeMoney ? studentPaymentStanding(context, student.id) : null,
      context.can(PERMISSIONS.DOCUMENT_VIEW)
        ? loadStudentDossier(context, student.id)
        : null,
      student.familyId ? findFamily(context, student.familyId) : null,
    ]);

  const currency = context.settings.currencyCode;
  const money = (centimes: number) => formatMoney(centimes, locale, currency);
  const primary =
    family?.guardians.find((guardian) => guardian.isPrimaryContact) ??
    family?.guardians[0];

  return (
    <PrintDocument
      letterhead={letterheadFrom(context)}
      title={t.student.situationSheet}
      subtitle={`${student.firstName} ${student.lastName}`}
      reference={student.code}
      backHref={`/students/${student.id}/dashboard`}
      locale={locale}
      t={t}
      signature={t.school.director}
    >
      {/* ── Identité ─────────────────────────────────────────────────────── */}
      <Section title={t.student.tabInformation}>
        <table className="print-table">
          <tbody>
            <Line label={t.student.lastName} value={student.lastName} />
            <Line label={t.student.firstName} value={student.firstName} />
            <Line
              label={t.student.birthDate}
              value={formatDate(new Date(student.birthDate), locale)}
            />
            <Line
              label={t.student.gender}
              value={
                t.studentOptions.genders[
                  student.gender as keyof typeof t.studentOptions.genders
                ]
              }
            />
            {enrolment ? (
              <>
                <Line label={t.enrolment.level} value={enrolment.levelName} />
                <Line
                  label={t.schoolClass.classColumn}
                  value={enrolment.className ?? "—"}
                />
              </>
            ) : null}
            {family ? (
              <Line label={t.family.household} value={family.name} />
            ) : null}
            {primary ? (
              <Line
                label={t.family.primaryContact}
                value={`${primary.firstName} ${primary.lastName}${
                  primary.phone ? ` — ${primary.phone}` : ""
                }`}
              />
            ) : null}
          </tbody>
        </table>
      </Section>

      {/* ── Notes ────────────────────────────────────────────────────────── */}
      {marks && marks.subjects.length > 0 ? (
        <Section
          title={`${t.student.tabMarks}${
            marks.overall === null
              ? ""
              : ` — ${t.assessment.overallAverage} ${marks.overall.toFixed(2)} / ${marks.outOf}`
          }`}
        >
          <table className="print-table">
            <thead>
              <tr>
                <th>{t.assessment.subject}</th>
                <th>{t.assessment.coefficient}</th>
                <th>{t.assessment.average}</th>
              </tr>
            </thead>
            <tbody>
              {marks.subjects.map((subject) => (
                <tr key={subject.subjectId}>
                  <td>{subject.subjectName}</td>
                  <td>{subject.coefficient}</td>
                  <td>
                    {subject.average === null
                      ? "—"
                      : `${subject.average.toFixed(2)} / ${marks.outOf}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {/* ── Assiduité ────────────────────────────────────────────────────── */}
      {attendance && attendance.rows.length > 0 ? (
        <Section title={t.student.tabAttendance}>
          <table className="print-table">
            <tbody>
              <Line
                label={t.classroom.attendanceRate}
                value={
                  attendance.attendanceRate === null
                    ? "—"
                    : `${attendance.attendanceRate}%`
                }
              />
              <Line
                label={t.classroomOptions.attendanceStatuses.ABSENT}
                value={String(attendance.tally.absent)}
              />
              <Line
                label={t.classroomOptions.attendanceStatuses.LATE}
                value={String(attendance.tally.late)}
              />
              <Line
                label={t.classroom.unjustified}
                value={String(attendance.unjustifiedAbsences)}
              />
            </tbody>
          </table>
        </Section>
      ) : null}

      {/* ── Frais ────────────────────────────────────────────────────────── */}
      {standing && standing.byService.length > 0 ? (
        <Section title={t.student.tabFees}>
          <table className="print-table">
            <thead>
              <tr>
                <th>{t.treasury.charged}</th>
                <th>{t.treasury.collected}</th>
                <th>{t.treasury.outstanding}</th>
                <th>{t.treasury.overdue}</th>
              </tr>
            </thead>
            <tbody>
              {standing.byService.map((service) => (
                <tr key={service.feeTypeId}>
                  <td>
                    {service.feeTypeName} — {money(service.chargedCentimes)}
                  </td>
                  <td>{money(service.paidCentimes)}</td>
                  <td>{money(service.outstandingCentimes)}</td>
                  <td>{money(service.overdueCentimes)}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <strong>{money(standing.chargedCentimes)}</strong>
                </td>
                <td>
                  <strong>{money(standing.paidCentimes)}</strong>
                </td>
                <td>
                  <strong>{money(standing.outstandingCentimes)}</strong>
                </td>
                <td>
                  <strong>{money(standing.overdueCentimes)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </Section>
      ) : null}

      {/* ── Dossier ──────────────────────────────────────────────────────── */}
      {dossier && dossier.pieces.length > 0 ? (
        <Section
          title={`${t.document.dossier} — ${interpolate(t.document.settledOf, {
            settled: dossier.standing.settledRequired,
            total: dossier.standing.totalRequired,
          })}`}
        >
          <table className="print-table">
            <tbody>
              {dossier.pieces
                .filter((piece) => piece.isRequired)
                .map((piece) => (
                  <Line
                    key={piece.documentTypeId}
                    label={piece.name}
                    value={
                      t.documentOptions.statuses[
                        piece.status as keyof typeof t.documentOptions.statuses
                      ] ?? piece.status
                    }
                  />
                ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {/* ── Remarques ────────────────────────────────────────────────────── */}
      {remarks && remarks.length > 0 ? (
        <Section title={t.classroom.remarks}>
          <table className="print-table">
            <tbody>
              {remarks.slice(0, 12).map((remark) => (
                <tr key={remark.id}>
                  <td>{formatDate(new Date(remark.occurredOn), locale)}</td>
                  <td>{remark.body}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}
    </PrintDocument>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <h2 className="mb-1.5 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{value}</td>
    </tr>
  );
}
