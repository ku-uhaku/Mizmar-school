import { defineModule } from "@/lib/module";

/**
 * Sign-in and sign-out. Contributes no nav entry — its only route, `/login`,
 * is outside the dashboard shell.
 *
 * Owns one table, `LoginAttempt`, which nothing in the app reads: it is the
 * brute-force throttle's counter, written before anybody is authenticated. The
 * user identity it authenticates against still belongs to the users module.
 */
export const authModule = defineModule({ id: "auth", schemaFolder: "auth" });
