"use client";

import * as React from "react";
import {
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
} from "lucide-react";

import { useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/**
 * Two boxes and the arrows between them: pick from the left, move to the right.
 *
 * The shape exists because "assign some of these to that" is a question a list
 * with a menu on every row answers badly — you cannot see what is already
 * assigned while you choose, and moving ten people means ten menus. Side by
 * side, both sets are visible at once and the arrow is the whole interaction.
 *
 * Domain-free on purpose: it knows about items with an id and a label, and
 * every word on it is passed in. `modules/classes` uses it for the roster;
 * anything else that assigns a set to a container can use it unchanged.
 *
 * Moves are reported one id at a time (`onMove`) rather than as a final list,
 * because the callers write one row per item — and one failure should leave the
 * rest of the batch moved rather than rolling the afternoon back.
 */

export type TransferItem = {
  id: string;
  label: string;
  /** Second line, for a reference number or a detail that disambiguates. */
  detail?: string;
  /** Small badge at the inline end — a group, a status. */
  badge?: string;
};

export function TransferList({
  available,
  assigned,
  availableTitle,
  assignedTitle,
  availableEmpty,
  assignedEmpty,
  onMove,
  disabled,
  /** Rendered under the assigned box — a capacity warning, say. */
  footer,
}: {
  available: TransferItem[];
  assigned: TransferItem[];
  availableTitle: string;
  assignedTitle: string;
  availableEmpty: string;
  assignedEmpty: string;
  /** `to` is the side the items are moving *into*. */
  onMove: (ids: string[], to: "assigned" | "available") => void;
  disabled?: boolean;
  footer?: React.ReactNode;
}) {
  const t = useT();
  const [pickedLeft, setPickedLeft] = React.useState<string[]>([]);
  const [pickedRight, setPickedRight] = React.useState<string[]>([]);
  const [filterLeft, setFilterLeft] = React.useState("");
  const [filterRight, setFilterRight] = React.useState("");

  // Selections are cleared by the caller re-rendering with new lists, so an id
  // that has already moved cannot be moved again.
  const visibleLeft = matching(available, filterLeft);
  const visibleRight = matching(assigned, filterRight);

  function move(ids: string[], to: "assigned" | "available") {
    if (ids.length === 0) return;
    onMove(ids, to);
    setPickedLeft([]);
    setPickedRight([]);
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <Box
          title={availableTitle}
          items={visibleLeft}
          total={available.length}
          picked={pickedLeft}
          onPickedChange={setPickedLeft}
          filter={filterLeft}
          onFilterChange={setFilterLeft}
          emptyLabel={availableEmpty}
          disabled={disabled}
          onDoubleClick={(id) => move([id], "assigned")}
        />

        {/* Vertical on a narrow screen, so the arrows still point the way the
            boxes are stacked. */}
        <div className="flex flex-row justify-center gap-2 md:flex-col">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={assignedTitle}
            disabled={disabled || pickedLeft.length === 0}
            onClick={() => move(pickedLeft, "assigned")}
          >
            <ChevronRightIcon className="rtl-flip max-md:rotate-90" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`${assignedTitle} — ${t.common.all}`}
            disabled={disabled || visibleLeft.length === 0}
            onClick={() => move(visibleLeft.map((item) => item.id), "assigned")}
          >
            <ChevronsRightIcon className="rtl-flip max-md:rotate-90" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={availableTitle}
            disabled={disabled || pickedRight.length === 0}
            onClick={() => move(pickedRight, "available")}
          >
            <ChevronLeftIcon className="rtl-flip max-md:rotate-90" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`${availableTitle} — ${t.common.all}`}
            disabled={disabled || visibleRight.length === 0}
            onClick={() => move(visibleRight.map((item) => item.id), "available")}
          >
            <ChevronsLeftIcon className="rtl-flip max-md:rotate-90" />
          </Button>
        </div>

        <Box
          title={assignedTitle}
          items={visibleRight}
          total={assigned.length}
          picked={pickedRight}
          onPickedChange={setPickedRight}
          filter={filterRight}
          onFilterChange={setFilterRight}
          emptyLabel={assignedEmpty}
          disabled={disabled}
          onDoubleClick={(id) => move([id], "available")}
        />
      </div>

      {footer}
    </div>
  );
}

function matching(items: TransferItem[], filter: string): TransferItem[] {
  const term = filter.trim().toLowerCase();
  if (term === "") return items;
  return items.filter((item) =>
    `${item.label} ${item.detail ?? ""}`.toLowerCase().includes(term),
  );
}

function Box({
  title,
  items,
  total,
  picked,
  onPickedChange,
  filter,
  onFilterChange,
  emptyLabel,
  disabled,
  onDoubleClick,
}: {
  title: string;
  items: TransferItem[];
  total: number;
  picked: string[];
  onPickedChange: (ids: string[]) => void;
  filter: string;
  onFilterChange: (value: string) => void;
  emptyLabel: string;
  disabled?: boolean;
  onDoubleClick: (id: string) => void;
}) {
  const t = useT();
  const allPicked = items.length > 0 && picked.length === items.length;

  function toggle(id: string, checked: boolean) {
    onPickedChange(
      checked ? [...picked, id] : picked.filter((other) => other !== id),
    );
  }

  return (
    <div className="bg-card flex min-w-0 flex-col rounded-xl ring-1 ring-foreground/10">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Checkbox
          checked={allPicked}
          disabled={disabled || items.length === 0}
          onCheckedChange={(checked) =>
            onPickedChange(checked === true ? items.map((item) => item.id) : [])
          }
          aria-label={t.common.selected}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {title}
        </span>
        <Badge variant="secondary" className="tabular-nums">
          {filter.trim() === "" ? total : `${items.length} / ${total}`}
        </Badge>
      </div>

      {total > 6 ? (
        <div className="relative border-b px-3 py-2">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute start-5 top-1/2 size-3.5 -translate-y-1/2" />
          <Input
            value={filter}
            onChange={(event) => onFilterChange(event.target.value)}
            placeholder={t.common.search}
            aria-label={`${title} — ${t.common.search}`}
            className="h-8 ps-7 text-sm"
          />
        </div>
      ) : null}

      <ScrollArea className="h-64">
        {items.length === 0 ? (
          <p className="text-muted-foreground px-3 py-10 text-center text-sm text-pretty">
            {emptyLabel}
          </p>
        ) : (
          <ul className="p-1">
            {items.map((item) => (
              <li key={item.id}>
                <label
                  className={cn(
                    "hover:bg-muted flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5",
                    picked.includes(item.id) && "bg-muted",
                  )}
                  // Double-click sends one item across without touching the
                  // arrows — the shortcut people who use these expect.
                  onDoubleClick={() => !disabled && onDoubleClick(item.id)}
                >
                  <Checkbox
                    checked={picked.includes(item.id)}
                    disabled={disabled}
                    onCheckedChange={(checked) =>
                      toggle(item.id, checked === true)
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{item.label}</span>
                    {item.detail ? (
                      <span className="text-muted-foreground block truncate text-xs">
                        {item.detail}
                      </span>
                    ) : null}
                  </span>
                  {item.badge ? (
                    <Badge variant="outline" className="shrink-0">
                      {item.badge}
                    </Badge>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}
