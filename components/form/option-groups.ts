/**
 * Cutting a list of options into the headed clusters a picker renders.
 *
 * Shared by the `Combobox` and by the plain `Select`s that list niveaux, so a
 * dropdown of levels looks the same wherever it appears and the rule lives in
 * one place — see modules/academics/labels.ts for why levels are grouped at
 * all.
 *
 * Built by walking the list rather than bucketing it, so the order the caller
 * chose survives: the levels arrive sorted by cycle then by year, and a `Map`
 * keyed on the heading would agree only as long as the groups never interleave
 * — which is the assumption that breaks quietly.
 */
export function clusterByGroup<T extends { group?: string }>(
  options: T[],
): { heading?: string; options: T[] }[] {
  const clusters: { heading?: string; options: T[] }[] = [];

  for (const option of options) {
    const last = clusters[clusters.length - 1];
    if (last && last.heading === option.group) last.options.push(option);
    else clusters.push({ heading: option.group, options: [option] });
  }

  return clusters;
}
