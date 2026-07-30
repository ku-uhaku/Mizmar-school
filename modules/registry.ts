import type { AppModule } from "@/lib/module";

import { accessModule } from "@/modules/access/module";
import { ROLE_PERMISSIONS } from "@/modules/access/permissions";
import { appearanceModule } from "@/modules/appearance/module";
import { authModule } from "@/modules/auth/module";
import { contextModule } from "@/modules/context/module";
import { dashboardModule } from "@/modules/dashboard/module";
import { organizationModule } from "@/modules/organization/module";
import { ORGANIZATION_PERMISSIONS } from "@/modules/organization/permissions";
import { profileModule } from "@/modules/profile/module";
import { schoolYearsModule } from "@/modules/school-years/module";
import { SCHOOL_YEAR_PERMISSIONS } from "@/modules/school-years/permissions";
import { schoolsModule } from "@/modules/schools/module";
import { SCHOOL_PERMISSIONS } from "@/modules/schools/permissions";
import { usersModule } from "@/modules/users/module";
import { USER_PERMISSIONS } from "@/modules/users/permissions";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE MODULE REGISTRY — the one file you edit when adding a module.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Everything the app knows about its own shape is derived from here:
 *
 *   lib/permissions.ts  → the permission catalogue, matrix layout and seed
 *   lib/nav.ts          → the sidebar
 *
 * Adding a module means: create `modules/<id>/`, then add its manifest to
 * `MODULES` and its permission object to `PERMISSIONS` below. Nothing else in
 * the app has a list that needs keeping in step — except the three dictionary
 * files, which import the module's translations (see lib/i18n/dictionaries/en.ts).
 *
 * Client-safe by construction: manifests and permission codes are plain data,
 * so this file may be imported from client components. Never import a module's
 * `queries.ts`, `service.ts` or `actions.ts` here — those are server-only and
 * would drag the database client into the browser bundle.
 */

/**
 * Registration order. It does not affect the sidebar (that sorts by `section`
 * and `order`), but it *is* the order the permission matrix lays its groups out
 * in — so keep it roughly "broadest domain first".
 */
export const MODULES: readonly AppModule[] = [
  dashboardModule,
  organizationModule,
  schoolsModule,
  schoolYearsModule,
  usersModule,
  accessModule,
  profileModule,
  appearanceModule,
  // No nav, no tables — registered so the registry is a complete inventory.
  authModule,
  contextModule,
];

/**
 * Every permission code in the app, keyed by a SCREAMING_CASE name.
 *
 * Spread rather than derived from `MODULES` on purpose: spreading the `as const`
 * objects keeps the string-literal types, which is what makes
 * `PERMISSIONS.SCHOOL_CREATE` autocomplete and what makes `PermissionCode` a
 * closed union instead of `string`. A key collision between two modules is a
 * silent override, so keep names prefixed with the module's domain.
 */
export const PERMISSIONS = {
  ...ORGANIZATION_PERMISSIONS,
  ...SCHOOL_PERMISSIONS,
  ...SCHOOL_YEAR_PERMISSIONS,
  ...USER_PERMISSIONS,
  ...ROLE_PERMISSIONS,
} as const;
