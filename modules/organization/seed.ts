import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * The single tenant. Created once and then left alone.
 *
 * ── Why the demonstration identity is opt-in ─────────────────────────────────
 * This is shared by all three orchestrators, and one of them — `seed-empty.ts` —
 * exists precisely so a real school starts from a database with nothing to
 * unpick. Planting "Groupe Scolaire Al Manar", a fabricated ICE, a Casablanca
 * address and a phone number nobody answers made that promise false in the one
 * place it mattered most: the organisation is what heads every printed receipt
 * and bulletin the school issues, and `modules/organization` offers only an
 * *update* action, so the fake identity is live until somebody notices it on
 * paper and goes looking for the screen that changes it.
 *
 * So the demonstration name is passed in by the demonstration seeds, and the
 * empty seed asks for none. What it gets instead is `SEED_ORG_NAME`, or a plain
 * placeholder that reads as something to fill in rather than as a real firm.
 * Nothing is invented: the registration numbers and contact details are left
 * null, which is what they honestly are until the school types them.
 */
export async function seedOrganization(
  db: SeedDb,
  demonstration?: { name: string; legalName: string; ice: string; taxId: string },
) {
  const existing = await db.organization.findFirst();
  if (existing) {
    log("organization", existing.name);
    return existing;
  }

  const organization = await db.organization.create({
    data: demonstration
      ? {
          ...demonstration,
          email: "contact@almanar.ma",
          phone: "+212 522 45 67 89",
          website: "https://almanar.ma",
          addressLine: "12, Boulevard Zerktouni",
          city: "Casablanca",
          region: "Casablanca-Settat",
          postalCode: "20250",
          country: "MA",
          defaultLocale: "fr",
        }
      : {
          // Everything else stays null. A blank field on the letterhead is an
          // obvious omission; a plausible wrong one is not.
          name: process.env.SEED_ORG_NAME ?? "Votre établissement",
          country: "MA",
          defaultLocale: "fr",
        },
  });

  log("organization", organization.name);
  return organization;
}

/** The demonstration tenant, for `seed.ts` and `seed-config.ts`. */
export const DEMO_ORGANIZATION = {
  name: "Groupe Scolaire Al Manar",
  legalName: "Groupe Scolaire Al Manar SARL",
  ice: "001945872000047",
  taxId: "14582369",
} as const;
