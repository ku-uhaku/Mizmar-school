import type { Metadata } from "next";
import { BuildingIcon, ShieldCheckIcon, UsersIcon } from "lucide-react";

import { LoginForm } from "@/modules/auth/components/login-form";
import { GroupMark, OwnerMark } from "@/modules/auth/components/brand-marks";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { ThemeModeToggle } from "@/modules/appearance/components/theme-mode-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage(props: PageProps<"/login">) {
  const t = await getDictionary();
  const { callbackUrl } = await props.searchParams;

  const highlights = [
    { icon: BuildingIcon, label: t.auth.highlightSchools },
    { icon: UsersIcon, label: t.auth.highlightPeople },
    { icon: ShieldCheckIcon, label: t.auth.highlightSecure },
  ];

  return (
    <main className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      {/* Information side. Hidden below lg so the small-screen experience stays
          the form and nothing else. */}
      <section className="bg-primary text-primary-foreground relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <div
          aria-hidden
          className="from-primary-foreground/15 pointer-events-none absolute -top-24 -end-24 size-96 rounded-full bg-radial to-transparent"
        />

        <p className="text-primary-foreground/70 relative text-sm font-medium tracking-wide uppercase">
          {t.auth.brandTagline}
        </p>

        <div className="relative max-w-md">
          <h1 className="text-4xl leading-tight font-semibold text-balance">
            {t.auth.panelHeadline}
          </h1>

          <ul className="mt-10 grid gap-5">
            {highlights.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-start gap-3">
                <span className="bg-primary-foreground/15 flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="size-4" />
                </span>
                <span className="text-primary-foreground/85 text-sm leading-6">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-primary-foreground/50 relative text-xs">
          © {new Date().getFullYear()}
        </p>
      </section>

      {/* Form side. */}
      <section className="relative flex flex-col px-6 py-8 sm:px-10">
        {/* Language and theme are reachable before signing in — the login screen
            itself has to be readable in the user's language. */}
        <div className="flex items-center justify-end gap-2">
          <LocaleSwitcher />
          <ThemeModeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <div className="mb-10 flex items-center justify-between gap-4">
              <GroupMark className="size-11" />
              <OwnerMark className="size-11" />
            </div>

            {/* On a card, like every other form in the app: the inputs are the
                same controls, and they only read the same on the same surface. */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-xl">{t.auth.signInTitle}</CardTitle>
                <CardDescription>{t.auth.signInSubtitle}</CardDescription>
              </CardHeader>
              <CardContent>
                <LoginForm
                  callbackUrl={
                    typeof callbackUrl === "string" ? callbackUrl : undefined
                  }
                />
              </CardContent>
            </Card>

            <p className="text-muted-foreground mt-10 text-center text-xs">
              {t.auth.poweredBy}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
