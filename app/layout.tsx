import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Noto_Sans_Arabic } from "next/font/google";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { AppearanceProvider, AppearanceScript } from "@/modules/appearance/components/appearance-provider";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { DirectionProvider } from "@/components/ui/direction";
import { RouteProgress } from "@/components/shell/route-progress";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { parseUiPrefsCookie, UI_PREFS_COOKIE, uiPrefsToDataAttributes } from "@/modules/appearance/prefs";
import { dirOf } from "@/lib/i18n/config";
import { getDictionaryFor, getLocale } from "@/lib/i18n/server";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
// Latin faces carry no Arabic glyphs; this sits in the fallback chain so Arabic
// renders correctly whichever font the user picks.
const notoArabic = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
});

export const metadata: Metadata = {
  title: {
    default: "Administration scolaire",
    template: "%s · Administration scolaire",
  },
  description:
    "Tableau de bord d'administration multi-écoles pour un groupe scolaire privé.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const dictionary = getDictionaryFor(locale);
  const dir = dirOf(locale);

  const prefs = parseUiPrefsCookie(
    (await cookies()).get(UI_PREFS_COOKIE)?.value,
  );

  const fontVariables = [
    geistSans.variable,
    geistMono.variable,
    inter.variable,
    notoArabic.variable,
  ].join(" ");

  return (
    <html
      lang={locale}
      dir={dir}
      // `mode: "system"` can only be resolved on the client, so the class this
      // renders may differ from the one AppearanceScript sets before paint.
      suppressHydrationWarning
      className={`${fontVariables} h-full antialiased ${
        prefs.mode === "dark" ? "dark" : ""
      }`}
      {...uiPrefsToDataAttributes(prefs)}
    >
      <body className="flex min-h-full flex-col">
        <AppearanceScript mode={prefs.mode} />
        <AppearanceProvider initial={prefs}>
          <I18nProvider locale={locale} dir={dir} dictionary={dictionary}>
            <DirectionProvider dir={dir}>
              {/* Required by every Tooltip in the tree — the collapsed sidebar
                  labels and the users table both rely on it. */}
              <TooltipProvider>
                {/* Suspense because it reads the query string: without it the
                    whole tree below would opt out of static rendering. */}
                <Suspense fallback={null}>
                  <RouteProgress />
                </Suspense>
                {children}
                <Toaster />
              </TooltipProvider>
            </DirectionProvider>
          </I18nProvider>
        </AppearanceProvider>
      </body>
    </html>
  );
}
