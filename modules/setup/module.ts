import { defineModule } from "@/lib/module";

/**
 * The new-school setup wizard: one guided pass that turns an empty school into
 * a configured one — its year and terms, the cycles it runs and the levels,
 * filières, subjects and programme inside them, its rooms, its bell schedule,
 * its classes and its fee catalogue.
 *
 * It owns no tables and declares no permissions of its own. Both are deliberate:
 * every row it writes belongs to the module that gives it meaning, and every
 * write is already covered by `school.create`, `schoolYear.create` and
 * `configuration.manage`. A wizard that invented a permission would be a second
 * answer to "who may configure a school".
 *
 * No nav entry either — configuring a school is a thing you do once, reached
 * from `/schools`, not a screen that earns a permanent place in the sidebar.
 */
export const setupModule = defineModule({
  id: "setup",
});
