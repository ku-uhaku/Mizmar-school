import type * as React from "react";

/**
 * Rule-and-label divider between the bands of a screen.
 *
 * Every band wears this one — a band that headed itself with a full-sized `h2`
 * would read as a second page title and flatten the order the bands are
 * deliberately in. It carries no margin of its own; the band spaces itself, so
 * the rhythm is set in one place rather than per caller.
 *
 * ── Why it lives here and not with the dashboard ────────────────────────────
 * It started on the main dashboard and every other screen that needed the same
 * divider wrote its own `<h2 className="text-sm font-medium">` instead, so the
 * app had a dozen slightly different band headings and one real one. It knows
 * nothing about schools, money or people, which is the test for belonging in
 * `components/` — see the layering note in AGENTS.md.
 *
 * ── Where it does not belong ────────────────────────────────────────────────
 * Inside a card. A mark sheet's toolbar, a dossier panel and the pupil's
 * workflow strip all head themselves, but they do it on a surface that already
 * has a border or a ring — and a rule drawn inside one of those reads as a
 * second, wrong edge. Those keep a plain heading on purpose. This is for the
 * gap *between* cards, not the top of one.
 */
export function SectionHeading({
  label,
  description,
  action,
}: {
  label: string;
  /** A clause after the label — kept on the rule line, never a second row. */
  description?: string;
  /** Rendered past the rule, at the inline end. */
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="text-muted-foreground shrink-0 text-xs font-medium tracking-wide uppercase">
        {label}
      </h2>
      {description ? (
        <p className="text-muted-foreground/70 hidden truncate text-xs sm:block">
          {description}
        </p>
      ) : null}
      <span className="bg-border h-px min-w-4 flex-1" />
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
