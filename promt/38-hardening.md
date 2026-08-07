# 38 — Final pass

**Prereqs:** everything.

---

The app works. Now make sure it is not quietly broken. Do these in order and
report findings before fixing anything — I want to see the list first.

**1. Layering audit.** Grep for violations of the import rules in `AGENTS.md`:
- `db` imported anywhere under `app/` — there must be none,
- `lib/` importing any module's `queries.ts` / `service.ts` / `actions.ts`,
- a module reaching into another module's table with a raw `db` call instead of
  going through the owner's `queries.ts`,
- `modules/registry.ts` imported outside `lib/permissions.ts` and `lib/nav.ts`,
- a server action exported through a barrel.

**2. Authorization audit.** For **every** exported function in every
`actions.ts`: does the body's first statement authorize, and is the scope
(`authorizeOrg` vs `authorizeSchool`) the right one for what it changes? Then for
every `queries.ts`: does the `where` derive from `AuthContext`, or does it trust
an id from the request? Produce a table: action → permission → scope → verdict.
This is the most valuable thing in this prompt; do not rush it.

**3. Tenant isolation test.** Seed a second organisation with its own school and
pupils. Then, signed in as org A, attempt to read and to write org B's rows by id
for every detail route and every action that takes an id. **Every one must fail.**
Report any that do not, with the route.

**4. i18n completeness.** Every user-facing string comes from a dictionary; no
literal text in a component. Every `en` key exists in `fr` and `ar` (the type
system should already guarantee this — confirm it still does). Every enum value
has a label in all three. Render each screen in Arabic and list anything that
breaks: `ml-`/`pl-`/`text-left` that slipped in, unmirrored icons, numbers in
the wrong direction.

**5. Money audit.** Grep for `Float` or `Number` arithmetic on anything ending in
`Centimes` or `Bps`. Every total must be integer arithmetic end to end, with
rounding only at display. Check that no discount or instalment split loses a
centime.

**6. N+1 and index audit.** Load each list screen with the seeded data and log
query counts. Anything over ~10 queries per page gets fixed. Confirm every
foreign key has an index and every `where` on a list has one behind it. Show me
`EXPLAIN` for the three slowest.

**7. Derived-column audit.** For each of `Student.status`, `SchoolYear.isDefault`,
`Guardian.isPrimaryContact`, `CashSession.openKey`,
`EmploymentContract.activeKey`, and every `scopeKey`/`bookingKey`: confirm there
is exactly **one** writer and no form can submit it.

**8. Error surfaces.** Every action returns a translated `failure()` for expected
problems and throws for bugs. No raw Prisma error text reaches a user. 404 and
403 pages exist in all three languages. A constraint violation shows a sentence a
secretary can act on.

**9. `AGENTS.md` reconciliation.** Update it to match what was actually built —
the module inventory table, the registration points, anything that drifted. It is
the entry point for whoever works on this next, including you.

**10. The gate**, on a clean checkout. First drop `--passWithNoTests` from the
`test` script in `package.json` — it was only there so the empty suite in
prompt 00 didn't fail the gate, and by now every module with an invariant worth
protecting should have landed at least one test under it:
```
npm ci && npm run typecheck && npm run lint && npm run format:check && npm run test && npm run build && npx prisma validate
npm run db:reset && npm run db:seed && npm run db:seed   # twice, on purpose
```

Report as a single findings list, ranked by severity, before you change a line.
