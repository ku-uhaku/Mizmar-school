import { MODULES, PERMISSIONS } from "@/modules/registry";
import type { PermissionGroup } from "@/lib/module";

/**
 * The permission catalogue, derived from the module registry.
 *
 * Codes are `<group>.<action>`. Each module declares its own in
 * `modules/<module>/permissions.ts`; this file only aggregates. Nothing outside
 * that catalogue can be granted, which keeps role editing from inventing
 * permissions the code never checks.
 *
 * Import `PERMISSIONS` from here (not from the registry) everywhere in the app,
 * so there is a single obvious home for permission concerns.
 */

export { PERMISSIONS };

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSION_CODES = Object.values(
  PERMISSIONS,
) as PermissionCode[];

/**
 * Drives both the seed and the layout of the permission matrix UI, in module
 * registration order. Labels come from the dictionary (`permissions.groups` and
 * `permissions.codes`), contributed by each module's `i18n/*.ts`.
 */
export const PERMISSION_GROUPS: PermissionGroup[] = MODULES.flatMap(
  (module) => module.permissions ?? [],
);

/** True when `value` is a code the app actually checks somewhere. */
export function isPermissionCode(value: string): value is PermissionCode {
  return (ALL_PERMISSION_CODES as string[]).includes(value);
}
