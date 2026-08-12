import type { Metadata } from "next";
import { SmartphoneIcon } from "lucide-react";

import { logoutAction } from "@/modules/auth/actions";
import { OrganizationMark } from "@/modules/auth/components/brand-marks";
import { loadOrganizationBrand } from "@/modules/organization/queries";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { ThemeModeToggle } from "@/modules/appearance/components/theme-mode-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Accès" };

/**
 * Where a session the web app will not open lands.
 *
 * A teacher's account is refused at sign-in, so in practice this is reached one
 * way: somebody who was staff this morning and is a teacher this afternoon,
 * still holding the cookie they were issued. `requireAuth` sends them here on
 * their next request — see lib/dal.ts.
 *
 * Deliberately does not call `requireAuth` itself, which would redirect it back
 * to itself for ever. It authorizes nothing because it shows nothing: the page
 * is a sentence and a way out.
 */
export default async function NoAccessPage() {
  const t = await getDictionary();
  const brand = await loadOrganizationBrand();

  return (
    <main className="flex min-h-svh flex-col px-6 py-8 sm:px-10">
      <div className="flex items-center justify-end gap-2">
        <LocaleSwitcher />
        <ThemeModeToggle />
      </div>

      <div className="flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-3">
            <OrganizationMark
              name={brand?.name ?? ""}
              logoUrl={brand?.logoUrl}
            />
            {brand ? (
              <span className="min-w-0 truncate text-lg font-semibold">
                {brand.name}
              </span>
            ) : null}
          </div>

          <Card>
            <CardHeader className="border-b">
              <span className="bg-muted text-muted-foreground mb-2 flex size-9 items-center justify-center rounded-lg">
                <SmartphoneIcon className="size-4" />
              </span>
              <CardTitle className="text-xl">{t.auth.noAccessTitle}</CardTitle>
              <CardDescription>{t.auth.noAccessBody}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <p className="text-muted-foreground text-sm leading-6">
                {t.auth.noAccessHint}
              </p>
              {/* Signing out is a mutation, so a form POST rather than a link. */}
              <form action={logoutAction}>
                <Button type="submit" variant="outline" className="w-full">
                  {t.auth.signOut}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
