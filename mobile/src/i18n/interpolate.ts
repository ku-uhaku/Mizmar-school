/**
 * Fills `{placeholder}` slots in a dictionary string.
 *
 *   interpolate("{count} of {total}", { count: 3, total: 9 }) // "3 of 9"
 */
export function interpolate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
