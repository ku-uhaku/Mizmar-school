# 04 — The design system

**Prereqs:** 02.
**Owns:** `components/{ui,form,data-table,charts,shared,print}`.
**Owns no tables. Knows no domain.** If a component here mentions a school, a
role or a pupil, it is in the wrong folder.

---

**`components/ui/`** — shadcn primitives, already installed in 00. Add
`direction.tsx`: a small provider that reads the locale and gives Radix its
`dir`, so popovers and sliders flip correctly in Arabic.

**Theming.** CSS variables for accent, radius, font family and font size, driven
by `data-*` attributes on `<html>`, plus a `ui-prefs` cookie so the first paint
is already correct. Support `light | dark | system`; accents as a named list;
radii `none|sm|md|lg|xl`; sizes `sm|md|lg|xl`. No flash of wrong theme.

**`components/form/`** — this is what makes 60 forms cheap.

- `form-field.tsx` — label, control slot, description, error, required marker.
  Errors come from `ActionState.fieldErrors`, keyed by field name.
- `form-page.tsx` — the standard create/edit page frame: header, sections, a
  sticky footer with cancel + submit.
- `form-nav.tsx` — in-page section navigation for the long forms (a pupil
  record has ~40 fields across 6 sections).
- `submit-button.tsx` — `useFormStatus`, disabled and spinning while pending.
- `combobox.tsx` — searchable single select over a large option list.
- `birth-date-field.tsx` — a date input that also shows the derived age. Age is
  **always derived**, never stored.
- `image-field.tsx` — avatar/logo upload with client-side downscale, a 256 KB
  cap, and accepted-type checks; validation shared with `lib/images.ts` so the
  server re-checks what the client claimed.
- `use-action-feedback.ts` — turns an `ActionState` into a sonner toast.

**`components/data-table/`** — one table component, TanStack Table v8, used by
every list screen in the app. It must support: column sorting, a text filter,
faceted filters (`data-table-facet.tsx`), pagination, column visibility, row
selection, an empty state, a loading skeleton, and CSV export. Server-side
pagination via searchParams, not client-side over a full fetch.

**`components/charts/`** — before writing any of these, **use the `dataviz`
skill**. Build: `stat-tile`, `sparkline`, `meter`, `split-bar`, `donut-chart`,
`column-chart`, `trend-chart`, `radial-gauge`, and shared `chart-parts`. Inline
SVG, no chart library, theme-aware, one palette defined once.

**`components/shared/`** — `confirm-delete.tsx` (a dialog that requires typing
the entity's name for destructive deletes) and `transfer-list.tsx` (the
two-column picker used for role permissions and class rosters).

**`components/print/`** — `print-document.tsx` (A4 frame, letterhead slot, page
breaks, `@media print` rules) and `print-button.tsx`.

**Gate:** a scratch page at `/kitchen-sink` (delete it at the end of this prompt)
showing every component in **light, dark, and Arabic RTL**. Screenshot it.
Nothing may be horizontally scrollable on a 360px viewport.
