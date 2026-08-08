"use client";

import { CheckIcon, PlusCircleIcon } from "lucide-react";
import type { Column } from "@tanstack/react-table";

import { useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/**
 * One value a column can be filtered to, already translated by the caller.
 *
 * `value` is compared against the column's accessor output, so it must be the
 * raw stored value (`"PRE_REGISTERED"`), not the label — otherwise the filter
 * would stop matching the moment somebody switches language.
 */
export type FacetOption = {
  value: string;
  label: string;
  icon?: React.ReactNode;
};

export type FacetDef = {
  /** Column id — must match a column's `id` or `accessorKey`. */
  columnId: string;
  label: string;
  options: FacetOption[];
};

/**
 * A multi-select filter, in the shape people already know from issue trackers:
 * a dashed "+ Status" button that fills with the chosen values.
 *
 * Presentational and state-free, so the same control serves both kinds of table
 * in the app — a client-side `DataTable`, which holds the selection in the
 * column, and a server-paged screen, which holds it in the URL. Counts are
 * optional because only the first can know them: a screen with twenty of four
 * hundred rows in hand cannot say how many pupils a value has behind it without
 * asking the database, and a number that counted only the page would be a lie.
 */
export function FacetFilter({
  label,
  options,
  selected,
  counts,
  onToggle,
  onClear,
}: {
  label: string;
  options: FacetOption[];
  selected: readonly string[];
  /** Rows behind each value, where the caller can know it. */
  counts?: Map<string, number>;
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const t = useT();
  const chosen = new Set(selected);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="border-dashed">
          <PlusCircleIcon />
          {label}
          {chosen.size > 0 ? (
            <>
              <Separator orientation="vertical" className="mx-0.5 h-4" />
              <span className="flex gap-1">
                {chosen.size > 2 ? (
                  <Badge variant="secondary" className="tabular-nums">
                    {chosen.size}
                  </Badge>
                ) : (
                  options
                    .filter((option) => chosen.has(option.value))
                    .map((option) => (
                      <Badge key={option.value} variant="secondary">
                        {option.label}
                      </Badge>
                    ))
                )}
              </span>
            </>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={label} />
          <CommandList>
            <CommandEmpty>{t.common.noResults}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = chosen.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => onToggle(option.value)}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-input",
                      )}
                    >
                      <CheckIcon
                        className={cn("size-3", !isSelected && "invisible")}
                      />
                    </span>
                    {option.icon}
                    <span className="truncate">{option.label}</span>
                    {counts ? (
                      <span className="text-muted-foreground ms-auto text-xs tabular-nums">
                        {counts.get(option.value) ?? 0}
                      </span>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>

            {chosen.size > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={onClear} className="justify-center">
                    {t.common.clearFilter}
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The column-bound version, for `DataTable`.
 *
 * Counts come from the rows the *other* filters have already left, so a value
 * showing 0 genuinely has nothing behind it in the current view rather than
 * being empty in the table as a whole.
 */
export function DataTableFacet<TData>({
  column,
  label,
  options,
}: {
  column: Column<TData, unknown>;
  label: string;
  options: FacetOption[];
}) {
  /*
    Re-keyed as strings to match `FacetOption.value`. `getFacetedUniqueValues`
    keys by the raw cell value, so a boolean column yields `true`/`false` and a
    lookup by "true" would silently report every value as empty — while the
    filter itself, which stringifies, went on working. Counts and filtering have
    to agree on the key or the numbers quietly lie.
  */
  const counts = new Map<string, number>();
  for (const [value, count] of column.getFacetedUniqueValues()) {
    const key = String(value);
    counts.set(key, (counts.get(key) ?? 0) + count);
  }

  const selected = (column.getFilterValue() as string[]) ?? [];

  return (
    <FacetFilter
      label={label}
      options={options}
      selected={selected}
      counts={counts}
      onToggle={(value) => {
        const next = new Set(selected);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        // An empty set is "no filter", not "match nothing" — passing `[]`
        // through would leave the column filtered to nothing at all.
        column.setFilterValue(next.size > 0 ? Array.from(next) : undefined);
      }}
      onClear={() => column.setFilterValue(undefined)}
    />
  );
}
