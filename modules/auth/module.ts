import { defineModule } from "@/lib/module";

/**
 * Sign-in and sign-out. Owns no tables (it reads User) and contributes no nav
 * entry — its only route, `/login`, is outside the dashboard shell.
 */
export const authModule = defineModule({ id: "auth" });
