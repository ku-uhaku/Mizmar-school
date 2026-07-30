import { defineModule } from "@/lib/module";

/**
 * The working context — which school and school year the user is currently
 * looking at. Lives on the User row rather than in a cookie so it cannot be
 * forged and follows the user across devices. Rendered in the header, so it
 * contributes no sidebar entry.
 */
export const contextModule = defineModule({ id: "context" });
