"use client";

import { useTransition } from "react";
import {
  CheckIcon,
  MonitorIcon,
  MoonIcon,
  RotateCcwIcon,
  SunIcon,
} from "lucide-react";

import { setLocaleAction } from "@/modules/appearance/actions";
import { useAppearance } from "@/modules/appearance/components/appearance-provider";
import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  ACCENTS,
  FONT_FAMILIES,
  FONT_SIZES,
  RADII,
  THEME_MODES,
  type Accent,
} from "@/modules/appearance/enums";
import { LOCALES, LOCALE_META, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

const MODE_ICONS = { light: SunIcon, dark: MoonIcon, system: MonitorIcon };

/** Swatch colours mirror the --primary values in globals.css. */
const ACCENT_SWATCH: Record<Accent, string> = {
  blue: "oklch(0.546 0.198 258.3)",
  emerald: "oklch(0.575 0.132 163.2)",
  violet: "oklch(0.548 0.229 292.8)",
  amber: "oklch(0.702 0.161 70.7)",
  rose: "oklch(0.586 0.215 16.2)",
  teal: "oklch(0.577 0.115 195.4)",
  neutral: "oklch(0.45 0 0)",
};

function OptionRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2.5">
      <div className="space-y-0.5">
        <Label>{label}</Label>
        {description ? (
          <p className="text-muted-foreground text-xs">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function AppearanceSettings() {
  const { t, locale } = useI18n();
  const { prefs, setPrefs, reset } = useAppearance();
  const [localePending, startLocaleTransition] = useTransition();

  function chooseLocale(next: Locale) {
    if (next === locale) return;
    startLocaleTransition(() => {
      void setLocaleAction(next);
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {/* Language */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.appearance.language}</CardTitle>
            <CardDescription>{t.appearance.languageHint}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-3">
              {LOCALES.map((code) => {
                const active = code === locale;
                return (
                  <button
                    key={code}
                    type="button"
                    disabled={localePending}
                    onClick={() => chooseLocale(code)}
                    aria-pressed={active}
                    className={cn(
                      "hover:bg-accent flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors disabled:opacity-60",
                      active && "border-primary bg-accent",
                    )}
                  >
                    <span className="flex flex-col items-start">
                      <span className="font-medium">
                        {LOCALE_META[code].label}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {LOCALE_META[code].dir.toUpperCase()}
                      </span>
                    </span>
                    {active ? <CheckIcon className="size-4" /> : null}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Theme + accent */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.appearance.title}</CardTitle>
            <CardDescription>{t.appearance.subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <OptionRow label={t.appearance.themeMode}>
              <div className="grid grid-cols-3 gap-2">
                {THEME_MODES.map((mode) => {
                  const Icon = MODE_ICONS[mode];
                  const active = prefs.mode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPrefs({ mode })}
                      aria-pressed={active}
                      className={cn(
                        "hover:bg-accent flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-sm transition-colors",
                        active && "border-primary bg-accent",
                      )}
                    >
                      <Icon className="size-4" />
                      {t.appearance.modes[mode]}
                    </button>
                  );
                })}
              </div>
            </OptionRow>

            <OptionRow label={t.appearance.accent}>
              <div className="flex flex-wrap gap-2">
                {ACCENTS.map((accent) => {
                  const active = prefs.accent === accent;
                  return (
                    <button
                      key={accent}
                      type="button"
                      onClick={() => setPrefs({ accent })}
                      aria-pressed={active}
                      aria-label={t.appearance.accents[accent]}
                      title={t.appearance.accents[accent]}
                      className={cn(
                        "flex size-9 items-center justify-center rounded-full border-2 transition-transform hover:scale-105",
                        active ? "border-foreground" : "border-transparent",
                      )}
                    >
                      <span
                        className="size-6 rounded-full"
                        style={{ background: ACCENT_SWATCH[accent] }}
                      />
                    </button>
                  );
                })}
              </div>
            </OptionRow>

            <OptionRow label={t.appearance.fontFamily}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {FONT_FAMILIES.map((font) => {
                  const active = prefs.fontFamily === font;
                  return (
                    <button
                      key={font}
                      type="button"
                      onClick={() => setPrefs({ fontFamily: font })}
                      aria-pressed={active}
                      className={cn(
                        "hover:bg-accent rounded-lg border px-3 py-2.5 text-sm transition-colors",
                        active && "border-primary bg-accent",
                        font === "mono" && "font-mono",
                      )}
                    >
                      {t.appearance.fonts[font]}
                    </button>
                  );
                })}
              </div>
            </OptionRow>

            <OptionRow label={t.appearance.fontSize}>
              <div className="grid grid-cols-4 gap-2">
                {FONT_SIZES.map((size) => {
                  const active = prefs.fontSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setPrefs({ fontSize: size })}
                      aria-pressed={active}
                      className={cn(
                        "hover:bg-accent rounded-lg border px-3 py-2.5 text-sm transition-colors",
                        active && "border-primary bg-accent",
                      )}
                    >
                      {t.appearance.sizes[size]}
                    </button>
                  );
                })}
              </div>
            </OptionRow>

            <OptionRow label={t.appearance.radius}>
              <div className="grid grid-cols-5 gap-2">
                {RADII.map((radius) => {
                  const active = prefs.radius === radius;
                  return (
                    <button
                      key={radius}
                      type="button"
                      onClick={() => setPrefs({ radius })}
                      aria-pressed={active}
                      className={cn(
                        "hover:bg-accent flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs transition-colors",
                        active && "border-primary bg-accent",
                      )}
                    >
                      <span
                        className="border-foreground/40 size-5 border-2 border-b-0 border-e-0"
                        style={{
                          borderStartStartRadius: {
                            none: "0",
                            sm: "3px",
                            md: "6px",
                            lg: "9px",
                            xl: "12px",
                          }[radius],
                        }}
                      />
                      {t.appearance.radii[radius]}
                    </button>
                  );
                })}
              </div>
            </OptionRow>

            <Button variant="outline" onClick={reset} className="w-fit">
              <RotateCcwIcon className="rtl-flip" />
              {t.appearance.reset}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Live preview — every control above applies instantly, so this is really
          just a compact sample of the components most affected. */}
      <Card className="h-fit lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle className="text-base">{t.appearance.preview}</CardTitle>
          <CardDescription>{t.appearance.previewBody}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <h3 className="font-heading text-lg font-semibold">
              {t.appearance.previewHeading}
            </h3>
            <p className="text-muted-foreground text-sm">
              {t.appearance.previewBody}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge>{t.common.active}</Badge>
            <Badge variant="secondary">{t.common.yes}</Badge>
            <Badge variant="outline">{t.common.no}</Badge>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="preview-input">{t.common.search}</Label>
            <Input id="preview-input" placeholder={t.common.search} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm">{t.appearance.previewButton}</Button>
            <Button size="sm" variant="outline">
              {t.appearance.previewSecondary}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
