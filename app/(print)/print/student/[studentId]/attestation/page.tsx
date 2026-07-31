import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintDocument } from "@/components/print/print-document";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { formatDate, interpolate } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { letterheadFrom } from "@/lib/letterhead";
import { PERMISSIONS } from "@/lib/permissions";
import { findEnrolment } from "@/modules/enrolment/queries";
import { findStudent } from "@/modules/students/queries";

export const metadata: Metadata = { title: "Attestation de scolarité" };

/**
 * The attestation de scolarité — the document families ask for constantly, for
 * the CNSS, an employer, a visa or a transfer.
 *
 * It asserts one thing: this child is enrolled here, this year, in this class.
 * So it refuses to print for a pupil with no inscription for the year in
 * context rather than issuing a certificate that says nothing — an attestation
 * with a blank class is worse than none, because somebody will still stamp it.
 */
export default async function AttestationPage({
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

  const enrolment = await findEnrolment(context, student.id);
  const yearName = context.currentSchoolYear?.name ?? "—";

  return (
    <PrintDocument
      letterhead={letterheadFrom(context)}
      title={t.print.attestation}
      reference={student.code}
      backHref={`/students/${student.id}`}
      locale={locale}
      t={t}
      signature={t.school.director}
    >
      {enrolment ? (
        <>
          <p className="mb-6 text-sm leading-relaxed text-pretty">
            {interpolate(t.print.attestationBody, { year: yearName })}
          </p>

          <table className="print-table">
            <tbody>
              <Line label={t.student.lastName} value={student.lastName} />
              <Line label={t.student.firstName} value={student.firstName} />
              {student.firstNameAr || student.lastNameAr ? (
                <Line
                  label={t.student.lastNameAr}
                  value={`${student.lastNameAr ?? ""} ${student.firstNameAr ?? ""}`.trim()}
                />
              ) : null}
              <Line
                label={t.student.birthDate}
                value={formatDate(student.birthDate, locale)}
              />
              {student.birthPlace ? (
                <Line label={t.student.birthPlace} value={student.birthPlace} />
              ) : null}
              {student.massarCode ? (
                <Line label={t.student.massarCode} value={student.massarCode} />
              ) : null}
              <Line label={t.enrolment.level} value={enrolment.levelName} />
              <Line
                label={t.assessment.class}
                value={enrolment.className ?? "—"}
              />
              <Line label={t.schoolYear.title} value={yearName} />
            </tbody>
          </table>

          <p className="mt-6 text-[11px] opacity-70">
            {t.print.issuedOn} {formatDate(new Date(), locale)}
          </p>
        </>
      ) : (
        <p className="text-sm">{t.enrolment.notEnrolled}</p>
      )}
    </PrintDocument>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <th className="w-48">{label}</th>
      <td className="font-medium">{value}</td>
    </tr>
  );
}
