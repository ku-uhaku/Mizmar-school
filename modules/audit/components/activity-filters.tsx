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
import { modelsInDomain } from "@/modules/audit/entities";
import { ACTIVITY_DOMAINS, type ActivityAction } from "@/modules/audit/enums";

/**
 * Who, what, where, when — all of it in the URL.
 *
 * The trail is read to answer a question somebody else asked, and the answer is
 * usually passed on: "look at this" is a link, not a description of which five
 * dropdowns to set. Keeping the filters in the query string also means the page
 * can be paged and filtered on the server, which is what stops a table that
 * grows by a line per write from being shipped whole to the browser.
 */

/** Select needs a non-empty value, and "no filter" has to be expressible. */
const ANY = "__any__";

export function ActivityFilters({
  actors,
  actions,
}: {
  actors: { id: string; label: string }[];
  actions: ActivityAction[];
}) {
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
      // Any change to the filters starts the results again from the top.
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const domain = current("domain");
  const entities = domain ? modelsInDomain(domain as never) : [];
  const hasFilters = ["actorId", "action", "domain", "entity", "from", "to", "search"]
    .some((key) => searchParams.get(key));

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      {/* Typing is not navigation: the search only moves the page on submit, so
        a seven-letter name costs one request rather than seven. Uncontrolled,
        and keyed on the value in the URL so that clearing the filters — which
        is a navigation — empties the box with them. */}
      <form
        className="grid min-w-64 flex-1 gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get("search");
          navigate({ search: typeof value === "string" ? value.trim() : "" });
        }}
      >
        <Label htmlFor="audit-search">{t.common.search}</Label>
        <div className="relative">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2" />
          <Input
            key={current("search")}
            id="audit-search"
            name="search"
            defaultValue={current("search")}
            placeholder={t.audit.searchPlaceholder}
            className="ps-8"
          />
        </div>
      </form>

      <Filter
        id="audit-actor"
        label={t.audit.actor}
        value={current("actorId")}
        placeholder={t.audit.allActors}
        options={actors.map((actor) => ({ value: actor.id, label: actor.label }))}
        onChange={(value) => navigate({ actorId: value })}
      />

      <Filter
        id="audit-action"
        label={t.audit.action}
        value={current("action")}
        placeholder={t.audit.allActions}
        options={actions.map((action) => ({
          value: action,
          label: t.auditOptions.actions[action],
        }))}
        onChange={(value) => navigate({ action: value })}
      />

      <Filter
        id="audit-domain"
        label={t.audit.domain}
        value={domain}
        placeholder={t.audit.allDomains}
        options={ACTIVITY_DOMAINS.map((value) => ({
          value,
          label: t.auditOptions.domains[value],
        }))}
        // Changing the area drops the record type with it: "Cash desk" and
        // "Pupil" together match nothing, and an empty screen with two filters
        // set reads as a bug rather than as a contradiction.
        onChange={(value) => navigate({ domain: value, entity: "" })}
      />

      {entities.length > 0 ? (
        <Filter
          id="audit-entity"
          label={t.audit.entity}
          value={current("entity")}
          placeholder={t.audit.allEntities}
          options={entities.map((entity) => ({
            value: entity,
            label:
              t.auditOptions.entities[
                entity as keyof typeof t.auditOptions.entities
              ] ?? entity,
          }))}
          onChange={(value) => navigate({ entity: value })}
        />
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="audit-from">{t.audit.dateFrom}</Label>
        <Input
          id="audit-from"
          type="date"
          value={current("from")}
          onChange={(event) => navigate({ from: event.target.value })}
          className="w-40"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="audit-to">{t.audit.dateTo}</Label>
        <Input
          id="audit-to"
          type="date"
          value={current("to")}
          onChange={(event) => navigate({ to: event.target.value })}
          className="w-40"
        />
      </div>

      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(pathname)}
        >
          <XIcon />
          {t.audit.clear}
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
    <div className="grid min-w-44 gap-2">
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
