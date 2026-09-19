import { TEMPLATE_VARIABLES, type TemplateVariable } from "@/modules/messaging/enums";

export type TemplateValues = Record<TemplateVariable, string>;

/**
 * Fills `{variables}` in. An unknown `{word}` is left as typed rather than
 * blanked, so a typo is visible in the preview instead of vanishing from a
 * message that has already gone to a parent.
 */
export function renderTemplate(template: string, values: TemplateValues): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    (TEMPLATE_VARIABLES as readonly string[]).includes(name)
      ? values[name as TemplateVariable]
      : whole,
  );
}

/** The `{words}` in a template that are not variables — shown as a warning. */
export function unknownVariables(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(/\{(\w+)\}/g)) {
    if (!(TEMPLATE_VARIABLES as readonly string[]).includes(match[1])) {
      found.add(match[1]);
    }
  }
  return [...found];
}
