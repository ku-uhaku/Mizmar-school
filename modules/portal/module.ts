import { defineModule } from "@/lib/module";

/**
 * The native app's read model — families, chauffeurs, teachers and direction,
 * served over `app/api/mobile/v1`.
 *
 * Owns no tables and contributes no nav entry: it has no screens in the web
 * app, and everything it reads belongs to another module. What it does own is
 * the one scoping rule the rest of the app has no use for — the household — by
 * which a guardian reaches their own children and nothing else. See
 * modules/portal/queries.ts.
 */
export const portalModule = defineModule({ id: "portal" });
