import { defineModule } from "@/lib/module";

/**
 * The curriculum framework a school teaches: cycles, levels, filières, subjects
 * and the programme that ties them together with coefficients and weekly loads.
 *
 * Year-independent by design — this is what the school is authorised and equipped
 * to teach. Which of it actually runs in a given year is `LevelOffering`, owned
 * by the `classes` module.
 *
 * No nav or permissions yet: the tables and their enums exist, the UI does not.
 * Both get added here when the screens are built.
 */
export const academicsModule = defineModule({
  id: "academics",
  schemaFolder: "academics",
});
