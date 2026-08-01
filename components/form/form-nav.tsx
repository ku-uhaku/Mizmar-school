"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type FormNavItem = { id: string; label: string };

/**
 * A jump list for a long full-page form, sat in the aside beside it.
 *
 * A fiche filled in from a paper form is read top to bottom, but it is *fixed*
 * out of order — a secretary called back about an allergy wants Health, not
 * eight sections of scrolling. The list doubles as a table of contents, so the
 * length of the form is legible before it is scrolled.
 *
 * The mark follows whichever section owns the top of the viewport rather than
 * whatever last crossed a threshold, which is what keeps it steady when a short
 * section and a long one are on screen together.
 */
export function FormNav({
  label,
  items,
}: {
  label: string;
  items: FormNavItem[];
}) {
  const [active, setActive] = React.useState(items[0]?.id ?? "");

  // Keyed by the ids rather than the array, which is rebuilt every render.
  const ids = items.map((item) => item.id).join(",");

  React.useEffect(() => {
    const sections = ids
      .split(",")
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);

    if (sections.length === 0) return;

    const sync = () => {
      const current =
        sections.find(
          (element) => element.getBoundingClientRect().bottom > 140,
        ) ?? sections[sections.length - 1];
      setActive(current.id);
    };

    // The observer only says "something moved"; `sync` decides what that means,
    // so a jump and a slow scroll settle on the same answer.
    const observer = new IntersectionObserver(sync, {
      threshold: [0, 0.25, 0.5, 1],
    });
    sections.forEach((element) => observer.observe(element));
    window.addEventListener("scroll", sync, { passive: true });
    sync();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", sync);
    };
  }, [ids]);

  return (
    <nav aria-label={label} className="hidden lg:block">
      <p className="text-muted-foreground mb-2 px-2 text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <ul className="border-border/70 border-s">
        {items.map((item) => {
          const isActive = item.id === active;

          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "-ms-px flex border-s-2 py-1.5 pe-2 ps-3 text-sm transition-colors",
                  isActive
                    ? "border-primary text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
