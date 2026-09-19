import { describe, expect, it } from "vitest";

import { matchesFilters, NO_FILTERS, parseFilters } from "@/modules/messaging/filters";
import { normalisePhone } from "@/modules/messaging/phone";
import { renderTemplate, unknownVariables } from "@/modules/messaging/template";

describe("normalisePhone", () => {
  it("reads a national Moroccan mobile", () => {
    expect(normalisePhone("06 12-34-56-78")).toBe("212612345678");
    expect(normalisePhone("0712345678")).toBe("212712345678");
  });

  it("accepts the international forms", () => {
    expect(normalisePhone("+212 612345678")).toBe("212612345678");
    expect(normalisePhone("00212612345678")).toBe("212612345678");
  });

  it("refuses a landline, a short number and nothing", () => {
    expect(normalisePhone("0522123456")).toBeNull();
    expect(normalisePhone("0612")).toBeNull();
    expect(normalisePhone("")).toBeNull();
    expect(normalisePhone(null)).toBeNull();
  });

  it("keeps a foreign number as given", () => {
    expect(normalisePhone("+33 6 12 34 56 78")).toBe("33612345678");
  });
});

describe("renderTemplate", () => {
  const values = {
    parent: "Karim",
    famille: "Alaoui",
    montant: "1 200,00 MAD",
    enfants: "Sara",
    ecole: "Mizmar",
    remarque: "Merci de passer.",
  };

  it("fills every variable", () => {
    expect(renderTemplate("{parent}: {montant} {remarque}", values)).toBe(
      "Karim: 1 200,00 MAD Merci de passer.",
    );
  });

  it("leaves an unknown word visible instead of blanking it", () => {
    expect(renderTemplate("{parnt}", values)).toBe("{parnt}");
    expect(unknownVariables("{parent} {parnt}")).toEqual(["parnt"]);
  });
});

describe("matchesFilters", () => {
  const target = {
    familyName: "Alaoui",
    familyCode: "F-001",
    contactName: "Karim Alaoui",
    overdueCentimes: 50_000,
    levelOfferingIds: ["l1"],
    classIds: ["c1"],
  };

  it("passes everything with no filter", () => {
    expect(matchesFilters(target, NO_FILTERS)).toBe(true);
  });

  it("applies the minimum, level, class and search together", () => {
    expect(matchesFilters(target, { ...NO_FILTERS, minCentimes: 60_000 })).toBe(false);
    expect(matchesFilters(target, { ...NO_FILTERS, levelOfferingId: "l2" })).toBe(false);
    expect(matchesFilters(target, { ...NO_FILTERS, classId: "c1" })).toBe(true);
    expect(matchesFilters(target, { ...NO_FILTERS, search: "karim" })).toBe(true);
    expect(matchesFilters(target, { ...NO_FILTERS, search: "zzz" })).toBe(false);
  });

  it("parses hostile input into safe defaults", () => {
    expect(parseFilters("nope")).toEqual(NO_FILTERS);
    expect(parseFilters({ minCentimes: -5, levelOfferingId: 3 })).toEqual(NO_FILTERS);
  });
});
