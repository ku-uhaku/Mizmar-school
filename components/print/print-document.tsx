import Link from "next/link";

import { PrintButton } from "@/components/print/print-button";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/types";
import { isDisplayableImage } from "@/lib/images";

export type PrintLetterhead = {
  organizationName: string;
  schoolName: string | null;
  logoUrl: string | null;
  addressLine: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
};

/**
 * The paper every document in the app is printed on.
 *
 * ── Header, footer, and why they are `position: fixed` ───────────────────────
 * A class list runs to three pages and the letterhead has to be on all of them.
 * The reliable way to get that without a PDF engine is a fixed header and
 * footer plus page padding, which every browser repeats on each printed sheet —
 * see the `@media print` block in globals.css.
 *
 * The screen shows the same thing at the same proportions, so what the user
 * reads before pressing the button is what comes out. That is the whole reason
 * these documents are HTML: the browser already lays out Arabic and French,
 * shapes the script, and handles the right-to-left run — none of which a PDF
 * library gives you without embedding fonts and fighting the bidi algorithm.
 */
export function PrintDocument({
  letterhead,
  title,
  subtitle,
  reference,
  backHref,
  locale,
  t,
  signature,
  orientation = "portrait",
  children,
}: {
  letterhead: PrintLetterhead;
  title: string;
  subtitle?: string;
  /** Document number, printed beside the date — a receipt is quoted by it. */
  reference?: string;
  backHref: string;
  locale: Locale;
  t: Dictionary;
  /** Who signs it. Omitted on documents nobody signs, like a class list. */
  signature?: string;
  /**
   * Landscape for documents wider than they are tall — a timetable week.
   * Emits its own `@page` rule; see the note in globals.css for why a *named*
   * page was wrong here.
   */
  orientation?: "portrait" | "landscape";
  children: React.ReactNode;
}) {
  const contact = [
    letterhead.addressLine,
    letterhead.city,
    letterhead.phone,
    letterhead.email,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={orientation === "landscape" ? "print-landscape" : undefined}>
      {/* Declared here rather than as a named `@page` in globals.css — see the
        note there. A print route renders one document and nothing else, so a
        global rule on this page is global over exactly that document. */}
      {orientation === "landscape" ? (
        <style>{"@page { size: A4 landscape; margin: 12mm; }"}</style>
      ) : null}

      {/* Screen only — never printed. See `.print-toolbar` in globals.css. */}
      <div className="print-toolbar">
        <Button asChild variant="ghost" size="sm">
          <Link href={backHref}>{t.common.back}</Link>
        </Button>
        <PrintButton label={t.print.download} />
      </div>

      <article className="print-page">
        <header className="print-header">
          <div className="flex items-start gap-4">
            {isDisplayableImage(letterhead.logoUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={letterhead.logoUrl as string}
                alt=""
                className="size-16 shrink-0 object-contain"
              />
            ) : null}

            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold">
                {letterhead.schoolName ?? letterhead.organizationName}
              </p>
              {letterhead.schoolName ? (
                <p className="text-xs opacity-70">
                  {letterhead.organizationName}
                </p>
              ) : null}
              {contact ? (
                <p className="mt-0.5 text-[10px] opacity-70">{contact}</p>
              ) : null}
            </div>

            <div className="shrink-0 text-end text-[10px] opacity-70">
              <p>{formatDate(new Date(), locale)}</p>
              {reference ? (
                <p className="font-medium tabular-nums" dir="ltr">
                  {reference}
                </p>
              ) : null}
            </div>
          </div>
          <div className="print-rule" />
        </header>

        <main className="print-body">
          <div className="mb-5 text-center">
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            {subtitle ? (
              <p className="mt-0.5 text-xs opacity-70">{subtitle}</p>
            ) : null}
          </div>

          {children}

          {signature ? (
            <div className="mt-10 flex justify-end">
              <div className="w-56 text-center">
                <p className="text-xs">{signature}</p>
                {/* Deliberately empty: it is signed by hand, on paper. */}
                <div className="mt-12 border-t pt-1 text-[10px] opacity-60">
                  {t.print.signatureAndStamp}
                </div>
              </div>
            </div>
          ) : null}
        </main>

        <footer className="print-footer">
          <div className="print-rule mb-1" />
          <div className="flex justify-between text-[9px] opacity-60">
            <span>
              {letterhead.schoolName ?? letterhead.organizationName}
              {letterhead.website ? ` · ${letterhead.website}` : ""}
            </span>
            <span>{t.print.generatedBy}</span>
          </div>
        </footer>
      </article>
    </div>
  );
}
