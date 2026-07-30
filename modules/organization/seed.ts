import { log, type SeedDb } from "@/prisma/seed/client";

/** The single tenant. Created once and then left alone. */
export async function seedOrganization(db: SeedDb) {
  const existing = await db.organization.findFirst();
  if (existing) {
    log("organization", existing.name);
    return existing;
  }

  const organization = await db.organization.create({
    data: {
      name: "Groupe Scolaire Al Manar",
      legalName: "Groupe Scolaire Al Manar SARL",
      ice: "001945872000047",
      taxId: "14582369",
      email: "contact@almanar.ma",
      phone: "+212 522 45 67 89",
      website: "https://almanar.ma",
      addressLine: "12, Boulevard Zerktouni",
      city: "Casablanca",
      region: "Casablanca-Settat",
      postalCode: "20250",
      country: "MA",
      defaultLocale: "fr",
    },
  });

  log("organization", organization.name);
  return organization;
}
