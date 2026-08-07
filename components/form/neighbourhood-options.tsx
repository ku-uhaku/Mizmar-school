"use client";

import * as React from "react";

import {
  SelectGroup,
  SelectItem,
  SelectLabel,
} from "@/components/ui/select";

/**
 * The quartier options of a `<Select>`, grouped under their towns.
 *
 * Shared by the three screens that ask for a quartier — the pupil form, the
 * pupil's transport arrangement and the bus stop — so a school serving two
 * towns reads the same list in all of them. Flat, they were one run of names
 * with no break in it, and the five that applied to the child in front of you
 * sat somewhere in the middle of another town's.
 *
 * Deliberately options rather than a whole Select: the three callers differ in
 * everything around them — one is uncontrolled and named for a form post, one
 * is controlled and resets the line beneath it when the quartier changes — and
 * a component that tried to own all of that would take more arguments than it
 * saved.
 *
 * Domain-free by the letter of the rule, and only just: it knows a quartier has
 * a town, which is the shape of the data rather than anything about schools.
 */
export function NeighbourhoodOptions({
  neighbourhoods,
}: {
  neighbourhoods: { id: string; label: string; cityName: string }[];
}) {
  // Insertion order is the query's — town, then quartier — so the groups come
  // out alphabetical without sorting them again here.
  const byTown = React.useMemo(() => {
    const groups = new Map<string, { id: string; label: string }[]>();
    for (const entry of neighbourhoods) {
      const group = groups.get(entry.cityName);
      if (group) group.push(entry);
      else groups.set(entry.cityName, [entry]);
    }
    return [...groups];
  }, [neighbourhoods]);

  return (
    <>
      {byTown.map(([town, entries]) => (
        <SelectGroup key={town}>
          <SelectLabel>{town}</SelectLabel>
          {entries.map((entry) => (
            <SelectItem key={entry.id} value={entry.id}>
              {/* The town is already the heading, so the row shows the quartier
                alone rather than repeating "Oujda · " down the whole group. */}
              {entry.label.includes(" · ")
                ? entry.label.slice(entry.label.indexOf(" · ") + 3)
                : entry.label}
            </SelectItem>
          ))}
        </SelectGroup>
      ))}
    </>
  );
}
