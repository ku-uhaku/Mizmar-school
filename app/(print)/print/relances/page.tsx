import type { Metadata } from "next";

import { PrintDocument } from "@/components/print/print-document";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { letterheadFrom } from "@/lib/letterhead";
import { PERMISSIONS } from "@/lib/permissions";
import { parseFilters } from "@/modules/messaging/filters";
import { renderFor, selectRecipients } from "@/modules/messaging/queries";

export const metadata: Metadata = { title: "Relances de paiement" };

type Search = { template?: string; remark?: string; filters?: string; excluded?: string };

/**
 * The reminders as they would be sent — one message per household — on paper.
 *
 * It resolves recipients with the same `selectRecipients` the send action uses,
 * so the sheet is what would go out and not a copy of what the screen showed.
 */
export default async function PrintRemindersPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const query = await searchParams;
  const context = await requireAuth();
  const t = await getDictionary();
  const locale = await getLocale();

  if (!context.can(PERMISSIONS.MESSAGING_SEND)) return <ForbiddenState />;

  let filters;
  try {
    filters = parseFilters(JSON.parse(query.filters ?? "{}"));
  } catch {
    filters = parseFilters({});
  }
  const template = (query.template ?? "").slice(0, 1000);
  const remark = (query.remark ?? "").slice(0, 500);
  const excluded = (query.excluded ?? "").split(",").filter(Boolean);

  const rows = await selectRecipients(context, filters, excluded);
  const schoolName = context.currentSchool?.name ?? "";

  return (
    <PrintDocument
      letterhead={letterheadFrom(context)}
      title={t.messaging.title}
      subtitle={schoolName}
      backHref="/caisse/relances"
      locale={locale}
      t={t}
    >
      <ol className="space-y-4 text-[12px]">
        {rows.map((row) => (
          <li key={row.familyId} className="break-inside-avoid border-b pb-3">
            <p className="text-[10px]" dir="ltr">
              {row.familyName} · +{row.phone}
            </p>
            <p className="whitespace-pre-wrap">
              {renderFor(template, row, remark, schoolName, locale, context.settings.currencyCode)}
            </p>
          </li>
        ))}
      </ol>
    </PrintDocument>
  );
}
