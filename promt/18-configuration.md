# 18 — `configuration`

**Prereqs:** 14, 15, 16, 17.
**Owns no tables** — it edits other modules' referentials.
**Routes:** `/configuration`, `/configuration/[section]`,
`/configuration/[section]/[resource]`.

---

One generic screen instead of fifteen hand-written CRUD pages. This module is
what makes the referential modules (14–17, and later `documents`, `supplies`,
`treasury`'s rubriques, `assessments`' types) cost almost nothing to add.

**The registry.** `modules/configuration/resources.ts` describes each editable
referential as data: id, owning module, section, labels (translation keys),
columns to show, the zod schema, and the four functions (`list`, `create`,
`update`, `delete`) — **imported from the owning module's `queries.ts` and
`actions.ts`**. `configuration` never writes another module's table directly; it
calls the owner. This is the rule from AGENTS.md applied at scale.

Sections to start with: **Cursus** (education levels, levels, tracks, subjects,
programme), **Établissement** (rooms, cities, neighbourhoods), **Facturation**
(fee types, fee rates, discounts).

**Screens:**
- `/configuration` — the section index, cards with counts.
- `/configuration/[section]` — the resources in that section.
- `/configuration/[section]/[resource]` — a data-table with inline create/edit
  in a sheet, delete with confirmation, reordering where `position` exists,
  and an active/inactive filter.

**Permissions:** `configuration.view`, `configuration.manage`. School-scoped —
a director configures their own school. Nav: `/configuration`, icon
`configuration`, `administration`, order 40.

**Delete is the hard part.** Referentials are pointed at by operational rows. A
delete must: check for dependents through the owning module, and if there are
any, refuse with a translated message naming the count and offering to
deactivate instead. Never cascade a referential delete into operational data.

**Gate:** add a subject, use it, then try to delete it and show me the refusal
with the dependent count. Then add one new resource to the registry and show me
that it took only a registry entry — no new page, no new route.
