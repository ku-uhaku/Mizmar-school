"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";

import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OPERATION_KINDS, PAYMENT_METHODS } from "@/modules/treasury/enums";

/**
 * The ledger's filters, all of them in the URL.
 *
 * Same arrangement as the trail's — see modules/audit/components/activity-filters.
 * They live in the query string because the window they narrow is decided on the
 * server: a facet that filtered only the rows already in the browser would answer
 * "which décaissements are there?" with "the ones on this page", which is worse
 * than not offering it.
 */

/** Select needs a non-empty value, and "no filter" has to be expressible. */
const ANY = "__any__";

const FILTER_KEYS = ["search", "kind", "method", "from", "to"] as const;

export function OperationsFilters() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = (key: string) => searchParams.get(key) ?? "";

  const navigate = React.useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === "" || value === ANY) params.delete(key);
        else params.set(key, value);
      }
      // Any change to the filters starts the ledger again from the top.
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const hasFilters = FILTER_KEYS.some((key) => searchParams.get(key));

  return (
    <div className="mb-3 flex flex-wrap items-end gap-3">
      {/* Typing is not navigation: the box moves the page on submit only, so a
        beneficiary's name costs one request rather than one per letter. Keyed
        on the value in the URL so clearing the filters empties it too. */}
      <form
        className="grid min-w-64 flex-1 gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get("search");
          navigate({ search: typeof value === "string" ? value.trim() : "" });
        }}
      >
        <Label htmlFor="operations-search">{t.common.search}</Label>
        <div className="relative">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2" />
          <Input
            key={current("search")}
            id="operations-search"
            name="search"
            defaultValue={current("search")}
            placeholder={t.treasury.searchOperations}
            className="ps-8"
          />
        </div>
      </form>

      <Filter
        id="operations-kind"
        label={t.treasury.kind}
        value={current("kind")}
        placeholder={t.treasury.allKinds}
        options={OPERATION_KINDS.map((value) => ({
          value,
          label: t.treasuryOptions.kinds[value],
        }))}
        onChange={(value) => navigate({ kind: value })}
      />

      <Filter
        id="operations-method"
        label={t.treasury.method}
        value={current("method")}
        placeholder={t.treasury.allMethods}
        options={PAYMENT_METHODS.map((value) => ({
          value,
          label: t.treasuryOptions.methods[value],
        }))}
        onChange={(value) => navigate({ method: value })}
      />

      <div className="grid gap-2">
        <Label htmlFor="operations-from">{t.treasury.dateFrom}</Label>
        <Input
          id="operations-from"
          type="date"
          value={current("from")}
          onChange={(event) => navigate({ from: event.target.value })}
          className="w-40"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="operations-to">{t.treasury.dateTo}</Label>
        <Input
          id="operations-to"
          type="date"
          value={current("to")}
          onChange={(event) => navigate({ to: event.target.value })}
          className="w-40"
        />
      </div>

      {hasFilters ? (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          <XIcon />
          {t.treasury.clearFilters}
        </Button>
      ) : null}
    </div>
  );
}

function Filter({
  id,
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid min-w-40 gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value === "" ? ANY : value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
