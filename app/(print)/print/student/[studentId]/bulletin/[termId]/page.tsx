import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintDocument } from "@/components/print/print-document";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { letterheadFrom } from "@/lib/letterhead";
import { PERMISSIONS } from "@/lib/permissions";
import { BulletinBody } from "@/modules/bulletins/components/bulletin-body";
import { findPupilBulletin } from "@/modules/bulletins/queries";

export const metadata: Metadata = { title: "Bulletin de notes" };

/**
 * One pupil's bulletin, on paper.
 *
 * Reached by pupil and term rather than by bulletin id, because that is how
 * every caller has it: the council's table knows the pupil it is looking at,
 * and the pupil's own file knows the term. The query resolves the pair inside
 * the school in context, so neither id is trusted.
 *
 * A draft prints too, and deliberately: the council reads a paper copy round
 * the table before deciding anything. What it must not do is *look* issued —
 * the status is on the subtitle, and the publication date is only there once
 * there is one.
 */
export default async function StudentBulletinPage({
  params,
}: {
  params: Promise<{ studentId: string; termId: string }>;
}) {
  const { studentId, termId } = await params;
  const context = await requireAuth();
  const t = await getDictionary();
  const locale = await getLocale();

  if (!context.can(PERMISSIONS.BULLETIN_VIEW)) {
    return <ForbiddenState />;
  }

  const bulletin = await findPupilBulletin(context, studentId, termId);
  if (!bulletin) notFound();

  return (
    <PrintDocument
      letterhead={letterheadFrom(context)}
      title={t.bulletin.reportCard}
      subtitle={`${bulletin.fullName} — ${bulletin.termName}${
        bulletin.isPublished
          ? ""
          : ` (${t.bulletinOptions.statuses.DRAFT})`
      }`}
      reference={bulletin.studentCode}
      backHref={`/students/${bulletin.studentId}`}
      locale={locale}
      t={t}
      signature={t.school.director}
    >
      <BulletinBody bulletin={bulletin} locale={locale} t={t} />
    </PrintDocument>
  );
}
