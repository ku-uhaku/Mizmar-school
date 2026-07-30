import { notFound, redirect } from "next/navigation";

import { findSection, resourcesInSection } from "@/modules/configuration/resources";

/** A section on its own has no screen — jump to its first resource. */
export default async function ConfigurationSectionPage(
  props: PageProps<"/configuration/[section]">,
) {
  const { section } = await props.params;

  if (!findSection(section)) notFound();
  const resource = resourcesInSection(section)[0];
  if (!resource) notFound();

  redirect(`/configuration/${section}/${resource.id}`);
}
