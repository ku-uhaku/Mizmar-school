"use client";

import { useTransition } from "react";
import { GlobeIcon } from "lucide-react";

import { setLocaleAction } from "@/app/actions/appearance";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALES, LOCALE_META, type Locale } from "@/lib/i18n/config";

export function LocaleSwitcher({
  variant = "ghost",
}: {
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const { locale, t } = useI18n();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    // The action rewrites the cookie and calls refresh(), so the server
    // re-renders with the new dictionary and text direction.
    startTransition(() => {
      void setLocaleAction(next);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size="icon"
          disabled={pending}
          aria-label={t.appearance.language}
        >
          <GlobeIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {LOCALES.map((code) => (
          <DropdownMenuItem
            key={code}
            onSelect={() => choose(code)}
            data-selected={code === locale ? "true" : undefined}
            className="justify-between"
          >
            <span>{LOCALE_META[code].label}</span>
            <span className="text-muted-foreground text-xs uppercase">
              {code}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
