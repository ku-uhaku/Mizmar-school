"use client";

import * as React from "react";
import { CalendarDaysIcon, CheckIcon, ChevronsUpDownIcon, SchoolIcon } from "lucide-react";
import { toast } from "sonner";

import { switchSchoolAction, switchSchoolYearAction } from "@/modules/context/actions";
import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isDisplayableImage } from "@/lib/images";
import { cn } from "@/lib/utils";

export type SchoolOption = {
  id: string;
  name: string;
  code: string;
  city: string | null;
  logoUrl: string | null;
};
export type YearOption = { id: string; name: string; status: string; isDefault: boolean };

/**
 * Switches the school / school year the whole dashboard is scoped to. The
 * actions persist the choice on the user record and call refresh(), so every
 * server component re-renders against the new context.
 */
export function ContextSwitcher({
  schools,
  years,
  currentSchoolId,
  currentYearId,
}: {
  schools: SchoolOption[];
  years: YearOption[];
  currentSchoolId: string | null;
  currentYearId: string | null;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = React.useTransition();
  const [schoolOpen, setSchoolOpen] = React.useState(false);
  const [yearOpen, setYearOpen] = React.useState(false);

  const currentSchool = schools.find((school) => school.id === currentSchoolId);
  const currentYear = years.find((year) => year.id === currentYearId);

  function run(action: () => Promise<{ status: string; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.status === "error" && result.message) toast.error(result.message);
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {/* School */}
      <Popover open={schoolOpen} onOpenChange={setSchoolOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={schoolOpen}
            disabled={pending || schools.length === 0}
            className="h-9 w-full justify-between gap-2 sm:w-56"
          >
            <SchoolIcon className="text-muted-foreground size-4 shrink-0" />
            <span className="truncate font-medium">
              {currentSchool?.name ?? t.context.noSchoolSelected}
            </span>
            <ChevronsUpDownIcon className="text-muted-foreground ms-auto size-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder={t.common.search} />
            <CommandList>
              <CommandEmpty>{t.context.noSchoolsAvailable}</CommandEmpty>
              <CommandGroup heading={t.context.school}>
                {schools.map((school) => (
                  <CommandItem
                    key={school.id}
                    value={`${school.name} ${school.code} ${school.city ?? ""}`}
                    onSelect={() => {
                      setSchoolOpen(false);
                      if (school.id !== currentSchoolId) {
                        run(() => switchSchoolAction(school.id));
                      }
                    }}
                  >
                    {/* The crest makes a list of similarly-named schools
                        scannable at a glance, which is the whole job here. */}
                    {isDisplayableImage(school.logoUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={school.logoUrl as string}
                        alt=""
                        className="bg-background size-6 shrink-0 rounded border object-contain"
                      />
                    ) : null}
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{school.name}</span>
                      <span className="text-muted-foreground truncate text-xs">
                        {school.code}
                        {school.city ? ` · ${school.city}` : ""}
                      </span>
                    </div>
                    <CheckIcon
                      className={cn(
                        "ms-auto size-4",
                        school.id === currentSchoolId ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* School year */}
      <Popover open={yearOpen} onOpenChange={setYearOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={yearOpen}
            disabled={pending || years.length === 0}
            className="h-9 w-full justify-between gap-2 sm:w-44"
          >
            <CalendarDaysIcon className="text-muted-foreground size-4 shrink-0" />
            <span className="truncate font-medium">
              {currentYear?.name ??
                (years.length === 0
                  ? t.context.noYearsAvailable
                  : t.context.noYearSelected)}
            </span>
            <ChevronsUpDownIcon className="text-muted-foreground ms-auto size-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandList>
              <CommandEmpty>{t.context.noYearsAvailable}</CommandEmpty>
              <CommandGroup heading={t.context.schoolYear}>
                {years.map((year) => (
                  <CommandItem
                    key={year.id}
                    value={year.name}
                    onSelect={() => {
                      setYearOpen(false);
                      if (year.id !== currentYearId) {
                        run(() => switchSchoolYearAction(year.id));
                      }
                    }}
                  >
                    <span>{year.name}</span>
                    {year.isDefault ? (
                      <Badge variant="secondary" className="ms-2">
                        {t.schoolYear.defaultBadge}
                      </Badge>
                    ) : null}
                    <CheckIcon
                      className={cn(
                        "ms-auto size-4",
                        year.id === currentYearId ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
