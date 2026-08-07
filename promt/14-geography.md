# 14 — `geography`

**Prereqs:** 07.
**Tables:** `City`, `Neighbourhood`. **No route** — edited under `/configuration`
(prompt 18); build the tables, queries and validation now because four later
modules need them.

---

Towns and quarters, per school. Pupils are born in a city, live in a
neighbourhood, and bus routes serve neighbourhoods — so this is a referential
three other modules depend on.

**`City`** — `schoolId` (Cascade), `code`, `name`, `nameAr?`, `region?`,
`isActive`. `@@unique([schoolId, code])`, `@@unique([schoolId, name])`.

**`Neighbourhood`** — `schoolId` (Cascade), `cityId` (**Restrict** — a quarter
without its town is meaningless), `code`, `name`, `nameAr?`, `landmark?`,
`isActive`. `@@unique([schoolId, code])`, `@@unique([cityId, name])`.

Both carry `schoolId` even though `Neighbourhood` could reach it through `City`,
because every list query filters on it and the join is not worth paying on every
read. Say that in a `///` comment — it is a deliberate denormalisation.

**Queries to export now** (they are what later modules consume):
`listCities(ctx)`, `listNeighbourhoods(ctx, { cityId? })`,
`neighbourhoodOptions(ctx)` returning `{ id, label }` grouped by city for the
`combobox`.

**No permission codes of its own** — it is edited through
`configuration.manage`. Note that in `module.ts`.

**Gate:** typecheck/`prisma validate`, plus a `seed.ts` inserting a realistic
Moroccan set (Casablanca, Rabat, Marrakech + a handful of quarters each) and
proof that re-running it changes nothing.
