import type { Metadata } from "next";
import { GraduationCapIcon } from "lucide-react";

import { LoginForm } from "@/modules/auth/components/login-form";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { ThemeModeToggle } from "@/modules/appearance/components/theme-mode-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage(props: PageProps<"/login">) {
  const t = await getDictionary();
  const { callbackUrl } = await props.searchParams;

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center px-4 py-10">
      {/* Language and theme are reachable before signing in — the login screen
          itself has to be readable in the user's language. */}
      <div className="absolute end-4 top-4 flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeModeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
            <GraduationCapIcon className="size-6" />
          </div>
          <p className="text-muted-foreground text-sm text-balance">
            {t.auth.brandTagline}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{t.auth.signInTitle}</CardTitle>
            <CardDescription>{t.auth.signInSubtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm
              callbackUrl={typeof callbackUrl === "string" ? callbackUrl : undefined}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
