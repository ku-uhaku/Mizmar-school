"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";

import { FacetFilter } from "@/components/data-table/data-table-facet";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GENDERS, STUDENT_STATUSES } from "@/modules/students/enums";
import type { StudentFacetOptions } from "@/modules/students/queries";

/**
 * The pupils list's search, facets and order — all of them in the URL.
 *
 * They live in the query string because the window they narrow is decided on
 * the server: a facet that filtered only the twenty rows already in the browser
 * would answer "who is not in a class?" with "nobody on this page". Same
 * arrangement as the caisse ledger's — see modules/treasury/components/table-filters.
 */

/** Stands in for "no class yet" — see `UNPLACED` in the module's queries. */
const UNPLACED = "__unplaced__";

const FILTER_KEYS = ["q", "status", "level", "class", "gender", "sort"] as const;

/** Multi-select facets travel as one comma-joined parameter. */
function readList(value: string | null): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

export function StudentsFilters({
  facetOptions,
}: {
  facetOptions: StudentFacetOptions;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigate = React.useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === "") params.delete(key);
        else params.set(key, value);
      }
      // Any change to what is being looked at starts the list again from the
      // top: page 7 of the old filter names nothing under the new one.
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  /** Ticking a facet value on or off, keeping the rest of the selection. */
  const toggle = React.useCallback(
    (key: string, value: string) => {
      const next = new Set(readList(searchParams.get(key)));
      if (next.has(value)) next.delete(value);
      else next.add(value);
      navigate({ [key]: [...next].join(",") });
    },
    [navigate, searchParams],
  );

  const facet = (
    key: string,
    label: string,
    options: { value: string; label: string }[],
  ) => (
    <FacetFilter
      label={label}
      options={options}
      selected={readList(searchParams.get(key))}
      onToggle={(value) => toggle(key, value)}
      onClear={() => navigate({ [key]: "" })}
    />
  );

  const search = searchParams.get("q") ?? "";
  const hasFilters = FILTER_KEYS.some((key) => searchParams.get(key));

  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
      {/* Typing is not navigation: the box moves the list on submit only, so a
        pupil's name costs one request rather than one per letter. Keyed on the
        value in the URL so clearing the filters empties it too. */}
      <form
        className="relative min-w-0 flex-1 sm:max-w-xs"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get("q");
          navigate({ q: typeof value === "string" ? value.trim() : "" });
        }}
      >
        <SearchIcon className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          key={search}
          name="q"
          defaultValue={search}
          placeholder={t.student.searchPlaceholder}
          aria-label={t.student.searchPlaceholder}
          className="ps-9"
        />
      </form>

      {facet(
        "status",
        t.school.status,
        STUDENT_STATUSES.map((status) => ({
          value: status,
          label: t.studentOptions.statuses[status],
        })),
      )}

      {facet(
        "level",
        t.enrolment.level,
        facetOptions.levels.map((level) => ({ value: level, label: level })),
      )}

      {facet("class", t.schoolClass.title, [
        ...facetOptions.classes.map((code) => ({ value: code, label: code })),
        { value: UNPLACED, label: t.student.notPlaced },
      ])}

      {facet(
        "gender",
        t.student.gender,
        GENDERS.map((gender) => ({
          value: gender,
          label: t.studentOptions.genders[gender],
        })),
      )}

      {/* Sorting is a select rather than clickable headers: the order is decided
        on the server now, and a header that sorted only the page in front of the
        reader would be the same lie the facets avoid. */}
      <Select
        value={searchParams.get("sort") ?? "name"}
        onValueChange={(value) => navigate({ sort: value === "name" ? "" : value })}
      >
        <SelectTrigger size="sm" className="w-auto" aria-label={t.student.sortBy}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="name">{t.student.sortName}</SelectItem>
          <SelectItem value="nameDesc">{t.student.sortNameDesc}</SelectItem>
          <SelectItem value="code">{t.student.sortCode}</SelectItem>
          <SelectItem value="newest">{t.student.sortNewest}</SelectItem>
          <SelectItem value="youngest">{t.student.sortYoungest}</SelectItem>
          <SelectItem value="oldest">{t.student.sortOldest}</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(pathname)}
        >
          <XIcon />
          {t.common.reset}
        </Button>
      ) : null}
    </div>
  );
}
