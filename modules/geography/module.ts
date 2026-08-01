import { defineModule } from "@/lib/module";

/**
 * Places the school writes down: towns, for now.
 *
 * Its own module rather than a table hung off `students` or `families`, because
 * every one of those would be a borrower rather than an owner — a town is where
 * a pupil was born, where a guardian lives and where the previous school stood,
 * and the module that owns it must be the one none of them is.
 *
 * No nav or permissions — the list is edited through the generic configuration
 * screens, like `academics` and `facilities`.
 */
export const geographyModule = defineModule({
  id: "geography",
  schemaFolder: "geography",
});
