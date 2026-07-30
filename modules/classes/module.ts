import { defineModule } from "@/lib/module";

/**
 * The cohorts of one school year: which levels the school opened, the classes
 * inside them, the groups a class splits into, and which teacher is answerable
 * for which subject.
 *
 * This is the module that turns the curriculum into a running year, so
 * everything it owns hangs off `SchoolYear` rather than `School`.
 *
 * No nav or permissions yet — tables only.
 */
export const classesModule = defineModule({
  id: "classes",
  schemaFolder: "classes",
});
