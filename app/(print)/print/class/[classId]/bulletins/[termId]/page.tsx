import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintDocument } from "@/components/print/print-document";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { letterheadFrom } from "@/lib/letterhead";
import { PERMISSIONS } from "@/lib/permissions";
import { BulletinBody } from "@/modules/bulletins/components/bulletin-body";
import { listClassBulletins } from "@/modules/bulletins/queries";

export const metadata: Metadata = { title: "Bulletins de la classe" };

/**
 * A whole class's bulletins, one per sheet.
 *
 * The batch a school actually prints: thirty documents come off the printer in
 * class-list order and get handed out at the meeting. Each pupil starts a new
 * page — `break-before: page` on every section but the first, so the run does
 * not open with a blank sheet.
 *
 * One `PrintDocument` wrapping the lot rather than one per pupil, because the
 * letterhead is `position: fixed` and repeats on every printed page by itself.
 * See the note on PrintDocument.
 */
export default async function ClassBulletinsPage({
  params,
}: {
  params: Promise<{ classId: string; termId: string }>;
}) {
  const { classId, termId } = await params;
  const context = await requireAuth();
  const t = await getDictionary();
  const locale = await getLocale();

  if (!context.can(PERMISSIONS.BULLETIN_VIEW)) {
    return <ForbiddenState />;
  }

  const bulletins = await listClassBulletins(context, classId, termId);
  if (bulletins.length === 0) notFound();

  const first = bulletins[0];

  return (
    <PrintDocument
      letterhead={letterheadFrom(context)}
      title={t.bulletin.reportCard}
      subtitle={`${first.className ?? first.levelName} — ${first.termName}`}
      backHref={`/bulletins?class=${classId}&term=${termId}`}
      locale={locale}
      t={t}
    >
      {bulletins.map((bulletin, index) => (
        <section
          key={bulletin.id}
          className={index === 0 ? undefined : "break-before-page"}
        >
          <h2 className="mb-2 text-center text-sm font-semibold">
            {bulletin.fullName}
          </h2>
          <BulletinBody bulletin={bulletin} locale={locale} t={t} />

          {/* Signed per pupil, not once for the batch: each sheet leaves on its
            own and has to carry its own signature. */}
          <div className="mt-8 flex justify-end">
            <div className="w-56 text-center">
              <p className="text-xs">{t.school.director}</p>
              <div className="mt-10 border-t pt-1 text-[10px] opacity-60">
                {t.print.signatureAndStamp}
              </div>
            </div>
          </div>
        </section>
      ))}
    </PrintDocument>
  );
}
