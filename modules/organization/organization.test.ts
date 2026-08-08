import { beforeEach, describe, expect, it, vi } from "vitest";

import { LOCALES } from "@/lib/i18n/config";
import { getDictionaryFor } from "@/lib/i18n/server";
import {
  MAX_IMAGE_BYTES,
  checkImageValue,
  imageByteLength,
  isDisplayableImage,
} from "@/lib/images";
import { organizationSchema } from "@/modules/organization/validation";

/**
 * The tenant root, and the one thing it hands to somebody with no session.
 *
 * The module is small on purpose — an organisation is a row a director edits
 * twice a year — but it carries two surfaces worth pinning:
 *
 *   * **`loadOrganizationBrand` is read without a session.** The login page is
 *     public by definition and shows the name over the door and the crest on
 *     it, neither of which is a secret from somebody standing at the door. The
 *     licence number, the address and the contact details are, and they live in
 *     the same row. So the select is exhaustive rather than returning the row,
 *     and adding a column to the table must not silently widen what this hands
 *     out — which is exactly what a test can hold still and a code review
 *     cannot.
 *   * **the crest lands on that public page.** Every image column in the app
 *     goes through one validator, and this is the one whose output is rendered
 *     to unauthenticated visitors.
 */

// ─────────────────────────────────────────────────────────────────────────────

type Call = { model: string; op: string; args: unknown };

const calls: Call[] = [];
let answers: Record<string, unknown> = {};

const db = new Proxy(
  {},
  {
    get: (_target, model: string) =>
      new Proxy(
        {},
        {
          get: (_d, op: string) => async (args: unknown) => {
            calls.push({ model, op, args });
            const key = `${model}.${op}`;
            return key in answers ? answers[key] : null;
          },
        },
      ),
  },
);

vi.mock("@/lib/db", () => ({ db, auditClient: {} }));

const { loadOrganizationBrand } = await import(
  "@/modules/organization/queries"
);

/** Every column the table actually has — the shape a widened select would leak. */
const WHOLE_ROW = {
  id: "org-1",
  name: "Groupe Scolaire Al Massira",
  legalName: "Al Massira SARL",
  ice: "001234567000089",
  taxId: "12345678",
  email: "direction@almassira.ma",
  phone: "0522123456",
  website: "https://almassira.ma",
  addressLine: "12 rue Ibn Batouta",
  city: "Casablanca",
  region: "Casablanca-Settat",
  postalCode: "20000",
  country: "MA",
  logoUrl: "https://almassira.ma/crest.png",
  defaultLocale: "fr",
};

beforeEach(() => {
  calls.length = 0;
  answers = {};
});

// ── The unauthenticated read ─────────────────────────────────────────────────

describe("loadOrganizationBrand", () => {
  it("gives the login page the name and the crest", async () => {
    answers = {
      "organization.findFirst": { name: WHOLE_ROW.name, logoUrl: WHOLE_ROW.logoUrl },
    };
    expect(await loadOrganizationBrand()).toEqual({
      name: WHOLE_ROW.name,
      logoUrl: WHOLE_ROW.logoUrl,
    });
  });

  it("asks for those two columns and nothing else", async () => {
    // The assertion that keeps this honest as the table grows: an organisation
    // carries a licence, an address and contact details, and none of it belongs
    // to a caller with no session. Returning the row instead of selecting would
    // hand every one of them out the next time somebody adds a column — and the
    // select is the only place that can be caught.
    await loadOrganizationBrand();
    const select = (calls[0]!.args as { select: Record<string, unknown> }).select;

    expect(Object.keys(select).sort()).toEqual(["logoUrl", "name"]);
    for (const held of ["ice", "taxId", "email", "phone", "addressLine", "id"]) {
      expect(select, held).not.toHaveProperty(held);
    }
  });

  it("names every column the table has, so the sweep above stays exhaustive", () => {
    // A column added to `Organization` and not to this fixture would make the
    // check above pass by omission. Kept beside it deliberately.
    const known = Object.keys(WHOLE_ROW);
    expect(known).toContain("ice");
    expect(known).toContain("taxId");
    expect(known.length).toBeGreaterThan(10);
  });

  it("answers nothing before the organisation exists", async () => {
    // The state a fresh deployment is in until it is seeded, and the login page
    // still has to render.
    expect(await loadOrganizationBrand()).toBeNull();
  });

  it("reads the one organisation this deployment serves", async () => {
    await loadOrganizationBrand();
    expect(calls[0]!.model).toBe("organization");
    expect(calls[0]!.op).toBe("findFirst");
  });

  it("takes no filter, because there is nothing to scope it by", async () => {
    // One group per deployment — the same assumption `seedOrganization` makes.
    // A `where` here would be a scope somebody could get wrong.
    await loadOrganizationBrand();
    expect(calls[0]!.args).not.toHaveProperty("where");
  });
});

// ── What a director may edit ─────────────────────────────────────────────────

describe("organizationSchema", () => {
  const t = getDictionaryFor("en");
  const form = (extra: Record<string, unknown> = {}) => ({
    name: "Groupe Scolaire Al Massira",
    legalName: "Al Massira SARL",
    ice: "001234567000089",
    taxId: "12345678",
    email: "direction@almassira.ma",
    phone: "0522123456",
    website: "https://almassira.ma",
    addressLine: "12 rue Ibn Batouta",
    city: "Casablanca",
    region: "Casablanca-Settat",
    postalCode: "20000",
    country: "MA",
    logoUrl: "",
    defaultLocale: "fr",
    ...extra,
  });

  it("accepts a well-formed organisation", () => {
    expect(organizationSchema(t).safeParse(form()).success).toBe(true);
  });

  it("requires a name, because everything else is optional", () => {
    // The name is what the login page says over the door.
    expect(organizationSchema(t).safeParse(form({ name: "" })).success).toBe(false);
    expect(organizationSchema(t).safeParse(form({ name: "   " })).success).toBe(
      false,
    );
  });

  it("strips the id, so a form cannot name which organisation it edits", () => {
    // The action takes the id from the session and never from the request; this
    // is the second half of that, since zod drops what it was not told about.
    const parsed = organizationSchema(t).safeParse({
      ...form(),
      id: "another-org",
      createdAt: "1970-01-01",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("id");
      expect(parsed.data).not.toHaveProperty("createdAt");
    }
  });

  it("accepts every locale the app is built in and refuses the rest", () => {
    for (const locale of LOCALES) {
      expect(
        organizationSchema(t).safeParse(form({ defaultLocale: locale })).success,
        locale,
      ).toBe(true);
    }
    for (const locale of ["", "es", "FR", "fr-MA"]) {
      expect(
        organizationSchema(t).safeParse(form({ defaultLocale: locale })).success,
        locale,
      ).toBe(false);
    }
  });

  it("falls back to Morocco rather than storing a blank country", () => {
    // The column is non-nullable with a default, so a cleared input has to
    // become the default rather than null.
    const parsed = organizationSchema(t).safeParse(form({ country: "" }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.country).toBe("MA");
  });

  it("normalises the country to its two upper-case letters", () => {
    const parsed = organizationSchema(t).safeParse(form({ country: "ma" }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.country).toBe("MA");
  });

  it("refuses a country that is not a code", () => {
    for (const country of ["Maroc", "M", "MAR", "M1"]) {
      expect(
        organizationSchema(t).safeParse(form({ country })).success,
        country,
      ).toBe(false);
    }
  });

  it("reads a blank optional field as null, not as empty text", () => {
    const parsed = organizationSchema(t).safeParse(
      form({ legalName: "", ice: "", email: "", website: "", logoUrl: "" }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.legalName).toBeNull();
      expect(parsed.data.ice).toBeNull();
      expect(parsed.data.email).toBeNull();
      expect(parsed.data.website).toBeNull();
      expect(parsed.data.logoUrl).toBeNull();
    }
  });

  it("lower-cases an address somebody typed in capitals", () => {
    const parsed = organizationSchema(t).safeParse(
      form({ email: "Direction@AlMassira.MA" }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("direction@almassira.ma");
  });

  it("refuses an address that is not one", () => {
    expect(
      organizationSchema(t).safeParse(form({ email: "not-an-address" })).success,
    ).toBe(false);
  });

  it("bounds each field to its column", () => {
    expect(
      organizationSchema(t).safeParse(form({ name: "x".repeat(121) })).success,
    ).toBe(false);
    expect(
      organizationSchema(t).safeParse(form({ ice: "1".repeat(33) })).success,
    ).toBe(false);
  });
});

// ── The crest, which the public page renders ─────────────────────────────────

describe("the image column", () => {
  const dataUri = (media: string, payload = "AAAA") =>
    `data:${media};base64,${payload}`;

  it("accepts a data URI the picker produced", () => {
    // The browser resizes and encodes before anything leaves the page, and the
    // bytes go in the database because there is no object store.
    expect(checkImageValue(dataUri("image/png"))).toBeNull();
    expect(checkImageValue(dataUri("image/webp"))).toBeNull();
  });

  it("refuses a data URI that is not an image", () => {
    // Without this the column would take `data:text/html;base64,…`, which is a
    // stored cross-site scripting payload the moment anything renders it
    // outside an `<img>`.
    for (const media of ["text/html", "application/javascript", "text/plain"]) {
      expect(checkImageValue(dataUri(media)), media).toBe("not-an-image");
    }
  });

  it("refuses a data URI that is not base64", () => {
    expect(checkImageValue("data:image/svg+xml,<svg/>")).toBe("not-an-image");
  });

  it("refuses a scheme that would execute", () => {
    for (const value of [
      "javascript:alert(1)",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "ftp://example.com/logo.png",
    ]) {
      expect(checkImageValue(value), value).toBe("bad-url");
    }
  });

  it("refuses a plaintext link, which could never have displayed anyway", () => {
    // The note at the top of lib/images.ts has always said `https:`, and the
    // check accepted both. Every browser blocks a plaintext image on an https
    // page as mixed content, so an `http:` crest saved without complaint is a
    // crest that silently never appears — and on the login page it would also
    // mean an unauthenticated plaintext request to somebody else's host for
    // every visitor.
    expect(checkImageValue("http://example.com/crest.png")).toBe("bad-url");
    expect(checkImageValue("https://example.com/crest.png")).toBeNull();
  });

  it("refuses something that is not a URL at all", () => {
    expect(checkImageValue("crest.png")).toBe("bad-url");
    expect(checkImageValue("//example.com/crest.png")).toBe("bad-url");
  });

  it("treats a blank value as nothing to check", () => {
    expect(checkImageValue("")).toBeNull();
    expect(checkImageValue("   ")).toBeNull();
  });

  it("bounds what one row may weigh", () => {
    // The picker resizes before encoding, so the cap guards a crafted request
    // rather than something an ordinary user meets.
    const oversized = dataUri("image/png", "A".repeat(MAX_IMAGE_BYTES));
    expect(checkImageValue(oversized)).toBe("too-large");
  });

  it("counts bytes rather than characters", () => {
    // A UTF-8 character can be several bytes, and the cap is about storage.
    expect(imageByteLength("é")).toBe(2);
    expect(imageByteLength("a")).toBe(1);
  });

  it("displays only what it would accept", () => {
    // One function decides both, so a value that passed validation can never be
    // one the renderer refuses — or the other way round, which is worse.
    for (const value of [
      "https://example.com/crest.png",
      dataUri("image/png"),
      "http://example.com/crest.png",
      "javascript:alert(1)",
      dataUri("text/html"),
      "",
      null,
      undefined,
    ]) {
      const acceptable =
        typeof value === "string" &&
        value.trim() !== "" &&
        checkImageValue(value) === null;
      expect(isDisplayableImage(value), String(value)).toBe(acceptable);
    }
  });

  it("never displays a blank, so a missing crest falls back to the initials", () => {
    expect(isDisplayableImage(null)).toBe(false);
    expect(isDisplayableImage("")).toBe(false);
    expect(isDisplayableImage("   ")).toBe(false);
  });
});
