"use client";

import * as React from "react";

import { FormField, controlProps } from "@/components/form/form-field";
import { FormGrid } from "@/components/form/form-page";
import { useT } from "@/components/providers/i18n-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SCHOOL_YEAR_STATUSES } from "@/modules/school-years/enums";
import type { SetupState } from "@/modules/setup/components/use-setup-state";

/** The year being taught, and how it splits into terms. */
export function YearStep({
  setup,
  errors,
}: {
  setup: SetupState;
  errors: Record<string, string>;
}) {
  const t = useT();
  const { year } = setup;

  return (
    <div className="grid gap-5">
      <FormGrid cols={3}>
        <FormField
          name="yearName"
          label={t.setup.year.name}
          hint={t.setup.year.nameHint}
          error={errors.yearName}
          required
        >
          <Input
            {...controlProps("yearName", errors.yearName, t.setup.year.nameHint)}
            value={year.name}
            onChange={(event) => year.setName(event.target.value)}
            dir="ltr"
            placeholder="2026-2027"
          />
        </FormField>

        <FormField name="yearStartDate" label={t.setup.year.startDate} error={errors.yearStartDate}>
          <Input
            {...controlProps("yearStartDate", errors.yearStartDate)}
            type="date"
            value={year.start}
            onChange={(event) => year.setStart(event.target.value)}
          />
        </FormField>

        <FormField name="yearEndDate" label={t.setup.year.endDate} error={errors.yearEndDate}>
          <Input
            {...controlProps("yearEndDate", errors.yearEndDate)}
            type="date"
            value={year.end}
            onChange={(event) => year.setEnd(event.target.value)}
          />
        </FormField>

        <FormField name="yearStatus" label={t.setup.year.status} error={errors.yearStatus}>
          <Select value={year.status} onValueChange={year.setStatus}>
            <SelectTrigger id="yearStatus" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCHOOL_YEAR_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {t.configOptions.termStatuses[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="yearStatus" value={year.status} />
        </FormField>

        <div className="grid gap-2">
          <Label>{t.setup.year.termCount}</Label>
          <Tabs
            value={String(year.termCount)}
            onValueChange={(value) => year.setTermCount(Number(value))}
          >
            <TabsList className="w-full">
              <TabsTrigger value="2" className="flex-1">
                {t.setup.year.twoTerms}
              </TabsTrigger>
              <TabsTrigger value="3" className="flex-1">
                {t.setup.year.threeTerms}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </FormGrid>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="yearIsDefault">{t.setup.year.isDefault}</Label>
            <p className="text-muted-foreground text-xs">{t.setup.year.isDefaultHint}</p>
          </div>
          <Switch
            id="yearIsDefault"
            checked={year.isDefault}
            onCheckedChange={(value) => year.setIsDefault(value === true)}
          />
          {year.isDefault ? <input type="hidden" name="yearIsDefault" value="on" /> : null}
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="withHolidays">{t.setup.year.withHolidays}</Label>
            <p className="text-muted-foreground text-xs">{t.setup.year.withHolidaysHint}</p>
          </div>
          <Switch
            id="withHolidays"
            checked={year.withHolidays}
            onCheckedChange={(value) => year.setWithHolidays(value === true)}
          />
          {year.withHolidays ? <input type="hidden" name="withHolidays" value="on" /> : null}
        </div>
      </div>

      <section className="grid gap-3">
        <div>
          <h3 className="text-sm font-semibold">{t.setup.year.terms}</h3>
          <p className="text-muted-foreground text-xs">{t.setup.year.termsHint}</p>
        </div>
        {errors.terms ? (
          <p role="alert" className="text-destructive text-xs font-medium">
            {errors.terms}
          </p>
        ) : null}

        {year.terms.map((term) => (
          <div key={term.key} className="grid gap-2 sm:grid-cols-[1fr_1fr_10rem_10rem]">
            <Input
              aria-label={t.setup.year.termName}
              value={term.name}
              onChange={(event) => year.updateTerm(term.number, { name: event.target.value })}
            />
            <Input
              aria-label={t.setup.year.termNameAr}
              dir="rtl"
              value={term.nameAr}
              onChange={(event) => year.updateTerm(term.number, { nameAr: event.target.value })}
            />
            <Input
              aria-label={t.setup.year.termStart}
              type="date"
              value={term.startDate}
              onChange={(event) => year.updateTerm(term.number, { startDate: event.target.value })}
            />
            <Input
              aria-label={t.setup.year.termEnd}
              type="date"
              value={term.endDate}
              onChange={(event) => year.updateTerm(term.number, { endDate: event.target.value })}
            />
          </div>
        ))}
      </section>
    </div>
  );
}

/** The year's hidden inputs: the five parallel term arrays. */
export function YearInputs({ setup }: { setup: SetupState }) {
  return (
    <>
      {setup.year.terms.map((term) => (
        <React.Fragment key={term.key}>
          <input type="hidden" name="termNumber" value={term.number} />
          <input type="hidden" name="termName" value={term.name} />
          <input type="hidden" name="termNameAr" value={term.nameAr} />
          <input type="hidden" name="termStartDate" value={term.startDate} />
          <input type="hidden" name="termEndDate" value={term.endDate} />
        </React.Fragment>
      ))}
    </>
  );
}
