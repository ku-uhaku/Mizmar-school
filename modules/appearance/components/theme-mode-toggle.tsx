"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

import { useAppearance } from "@/modules/appearance/components/appearance-provider";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { THEME_MODES, type ThemeMode } from "@/modules/appearance/enums";

const ICONS: Record<ThemeMode, typeof SunIcon> = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
};

export function ThemeModeToggle({
  variant = "ghost",
}: {
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const t = useT();
  const { prefs, resolvedMode, setPrefs } = useAppearance();

  const Icon = resolvedMode === "dark" ? MoonIcon : SunIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size="icon"
          aria-label={t.appearance.themeMode}
        >
          <Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {THEME_MODES.map((mode) => {
          const ModeIcon = ICONS[mode];
          return (
            <DropdownMenuItem
              key={mode}
              onSelect={() => setPrefs({ mode })}
              data-selected={mode === prefs.mode ? "true" : undefined}
            >
              <ModeIcon />
              {t.appearance.modes[mode]}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
