import { defineModule } from "@/lib/module";
import { AUDIT_PERMISSIONS } from "@/modules/audit/permissions";

/**
 * Journal d'activité: everything anybody did, and what it changed.
 *
 * The module owns one table and no writes of its own — the trail is filled by
 * `lib/audit.ts`, which sits inside the Prisma client and sees every write the
 * app makes. What lives here is the reading of it: how a raw column diff is
 * turned into a sentence a director can act on, and who is allowed to see it.
 *
 * The nav entry is school-scoped, which an org-wide grant satisfies too. Both
 * kinds of reader are real: an administrator asking "who did this, anywhere",
 * and a head asking it of their own school. What each of them actually gets
 * back is decided in `queries.ts`, from their permissions rather than from
 * anything in the request — so the same link is honest for both.
 */
export const auditModule = defineModule({
  id: "audit",
  schemaFolder: "audit",
  nav: [
    {
      href: "/audit",
      icon: "audit",
      section: "administration",
      labelKey: "audit",
      // Below the things it is a trail *of*.
      order: 50,
      schoolPermission: AUDIT_PERMISSIONS.AUDIT_VIEW,
    },
  ],
  permissions: [{ group: "audit", codes: Object.values(AUDIT_PERMISSIONS) }],
});
