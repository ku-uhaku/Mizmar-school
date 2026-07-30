import { redirect } from "next/navigation";

import { SECTIONS, resourcesInSection } from "@/modules/configuration/resources";

/** Lands on the first screen of the first section. */
export default function ConfigurationIndexPage() {
  const section = SECTIONS[0];
  const resource = resourcesInSection(section.id)[0];
  redirect(`/configuration/${section.id}/${resource.id}`);
}
