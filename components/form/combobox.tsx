"use client";

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import * as React from "react";

import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ComboboxOption = {
  value: string;
  label: string;
  /** A second line — a matricule, a phone, the rubrique a supplier posts under. */
  hint?: string;
  /** Searchable text beyond the label: a code somebody types instead of a name. */
  keywords?: string;
  disabled?: boolean;
};

/**
 * A picker that can be typed into.
 *
 * ── Why this exists beside `Select` ─────────────────────────────────────────
 * A `Select` is right for a closed handful — cash, cheque, virement. It is
 * unusable for the lists this app actually carries: five hundred pupils, two
 * hundred and fifty households, a hundred staff, eighty catalogue articles. A
 * secretary looking for "Bennani" should not be scrolling.
 *
 * ── The search box appears only when it earns its place ─────────────────────
 * Above `searchFrom` options the list gets a filter; below it, the popover is
 * just a list. A search field over four choices is noise, and a list of five
 * hundred without one is unusable — the threshold is the whole point rather
 * than an afterthought, which is why it is a prop with a sane default and not a
 * decision each caller makes badly.
 *
 * ── It posts like a `Select` ────────────────────────────────────────────────
 * The value travels in a hidden input carrying `name`, so a Server Function
 * reads it exactly as it read the native control this replaces. That is what
 * makes it a drop-in: no action, no schema and no validation changes.
 */
export function Combobox({
  name,
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  id,
  disabled,
  required,
  className,
  searchFrom = 8,
  /** Offered as the first row, for the pickers where "none" is a real answer. */
  emptyOption,
}: {
  name?: string;
  options: ComboboxOption[];
  /** Controlled. Leave unset and pass `defaultValue` for an uncontrolled one. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  /** How many options before the filter box appears. */
  searchFrom?: number;
  emptyOption?: { value: string; label: string };
}) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue ?? "");

  // Controlled when the caller passes `value`, exactly as `Select` behaves —
  // half the screens here drive their pickers and half do not.
  const current = value ?? uncontrolled;

  const rows = React.useMemo(
    () => (emptyOption ? [{ ...emptyOption, hint: undefined }, ...options] : options),
    [emptyOption, options],
  );

  const selected = rows.find((option) => option.value === current) ?? null;
  const searchable = rows.length >= searchFrom;

  function choose(next: string) {
    if (value === undefined) setUncontrolled(next);
    onValueChange?.(next);
    setOpen(false);
  }

  return (
    <>
      {/* What the form actually posts. Kept outside the popover so it is in the
        DOM whether or not the list has ever been opened. */}
      {name ? (
        <input type="hidden" name={name} value={current} required={required} />
      ) : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              !selected && "text-muted-foreground",
              className,
            )}
          >
            <span className="truncate">
              {selected?.label ?? placeholder ?? t.common.select}
            </span>
            <ChevronsUpDownIcon className="ms-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-(--radix-popover-trigger-width) p-0"
          align="start"
        >
          <Command
            // cmdk's own scoring reorders on every keystroke, which makes a long
            // list jump around. The rows are already in the order the school
            // chose — by position, by name — so keep it and only filter.
            filter={(itemValue, search) =>
              itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
            }
          >
            {searchable ? (
              <CommandInput placeholder={t.common.searchPlaceholder} />
            ) : null}
            <CommandList>
              <CommandEmpty>{t.common.noResults}</CommandEmpty>
              <CommandGroup>
                {rows.map((option) => (
                  <CommandItem
                    key={option.value}
                    // What cmdk matches on: the label, plus whatever else
                    // somebody might type — a matricule, a code.
                    value={`${option.label} ${option.keywords ?? ""} ${option.hint ?? ""}`}
                    disabled={option.disabled}
                    onSelect={() => choose(option.value)}
                  >
                    <CheckIcon
                      className={cn(
                        "size-4",
                        option.value === current ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{option.label}</span>
                      {option.hint ? (
                        <span className="text-muted-foreground block truncate text-xs">
                          {option.hint}
                        </span>
                      ) : null}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
