# 05 — The application shell

**Prereqs:** 01, 02, 03, 04.
**Owns:** `components/shell/`, `app/(dashboard)/layout.tsx`.

---

The frame every signed-in screen lives in. Still no domain tables.

**`app/(dashboard)/layout.tsx`** — `requireAuth()`, load the dictionary, render
sidebar + header + content. Suspense boundaries around anything that queries.

**`components/shell/app-sidebar.tsx`** — collapsible shadcn sidebar. Sections and
entries come from `lib/nav.ts`, which derives them from `MODULES`. **There is no
list of routes in this file.** Adding a module makes a link appear; that is the
whole point of prompt 01.

**`components/shell/nav-icon.tsx`** — maps every `NavIcon` name to a lucide
component. This is the *only* place icons are resolved, because icons cannot
cross the server/client boundary as components. A `switch` with no `default`, so
adding a name to the union without adding it here is a type error.

Also in `components/shell/`:
- `page-header.tsx` — title, description, breadcrumb, action slot. Every page
  uses it; no page rolls its own heading.
- `section-links.tsx` / `section-scope.tsx` — the sub-navigation for the
  multi-screen sections (`/caisse/*`, `/hr/*`, `/transport/*`, `/teacher/*`).
- `empty-state.tsx` and `states.tsx` — loading / empty / error, used everywhere
  so the app never shows a blank box.
- `user-menu.tsx` — avatar, name, links to `/profile` and `/appearance`, sign out.
- `locale-switcher.tsx` — fr / en / ar, writes `Profile.locale` when signed in
  and the `ui-prefs` cookie always.
- `fullscreen-toggle.tsx`.

**Reserve the header slot** for the school + year switcher and the global search.
Both are built in later prompts (11 and 25). Leave a typed placeholder, not a
`TODO` comment.

**Gate:** typecheck/lint/build. Sign in, see an empty sidebar with only the
account section, switch to Arabic and confirm the whole shell mirrors. Show me
`lib/nav.ts` and confirm no route string appears in `app-sidebar.tsx`.
