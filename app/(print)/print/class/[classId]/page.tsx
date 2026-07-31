import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintDocument } from "@/components/print/print-document";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { formatDate, interpolate } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { letterheadFrom } from "@/lib/letterhead";
import { PERMISSIONS } from "@/lib/permissions";
import { ageFrom } from "@/lib/utils";
import { findClass } from "@/modules/classes/queries";

export const metadata: Metadata = { title: "Liste de classe" };

/**
 * The class list — the sheet that goes on a clipboard.
 *
 * Numbered rows and a wide empty column on the right, because the printed copy
 * is used as a tally sheet: registers, trip consent, book collection. A list
 * that fills the whole width with data leaves nowhere to tick, and somebody
 * ends up writing across the names.
 */
export default async function ClassListPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const context = await requireAuth();
  const t = await getDictionary();
  const locale = await getLocale();

  if (!context.can(PERMISSIONS.CLASS_VIEW)) {
    return <ForbiddenState />;
  }

  const schoolClass = await findClass(context, classId);
  if (!schoolClass) notFound();

  return (
    <PrintDocument
      letterhead={letterheadFrom(context)}
      title={t.print.classList}
      subtitle={`${schoolClass.code} · ${schoolClass.levelLabel} · ${context.currentSchoolYear?.name ?? ""}`}
      reference={interpolate(t.print.pupilCount, {
        count: schoolClass.roster.length,
      })}
      backHref={`/classes/${schoolClass.id}`}
      locale={locale}
      t={t}
    >
      <table className="print-table">
        <thead>
          <tr>
            <th className="w-8 text-end">#</th>
            <th>{t.student.lastName}</th>
            <th>{t.student.firstName}</th>
            <th className="w-24">{t.student.code}</th>
            <th className="w-16 text-end">{t.student.age}</th>
            <th className="w-16">{t.student.gender}</th>
            {/* Left blank on purpose — see the note above. */}
            <th className="w-40" />
          </tr>
        </thead>
        <tbody>
          {schoolClass.roster.map((pupil, index) => {
            const age = ageFrom(pupil.birthDate);
            return (
              <tr key={pupil.enrollmentId}>
                <td className="text-end tabular-nums">{index + 1}</td>
                <td className="font-medium">{pupil.lastName}</td>
                <td>{pupil.firstName}</td>
                <td className="tabular-nums" dir="ltr">
                  {pupil.code}
                </td>
                <td className="text-end tabular-nums">{age ?? "—"}</td>
                <td>
                  {
                    t.studentOptions.genders[
                      pupil.gender as keyof typeof t.studentOptions.genders
                    ]
                  }
                </td>
                <td />
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-4 text-[10px] opacity-60">
        {schoolClass.mainTeacherName
          ? `${t.schoolClass.mainTeacher}: ${schoolClass.mainTeacherName} · `
          : ""}
        {t.print.issuedOn} {formatDate(new Date(), locale)}
      </p>
    </PrintDocument>
  );
}
