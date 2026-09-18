import { describe, expect, it } from "vitest";

import { readSheet, readWorkbook } from "@/lib/xlsx";
import { buildWorkbook } from "@/lib/xlsx-build";

/** The originating writer: small, but every file the app hands out passes through it. */
describe("buildWorkbook", () => {
  const read = (buffer: Buffer, sheet: string) => readSheet(readWorkbook(buffer), sheet);

  it("round-trips strings, numbers and blanks by cell reference", () => {
    const cells = read(buildWorkbook("Liste", [["a", 2, null, "d"], [], [null, "b2"]]), "Liste");
    expect(cells.get("A1")).toBe("a");
    expect(cells.get("B1")).toBe("2");
    expect(cells.has("C1")).toBe(false);
    expect(cells.get("D1")).toBe("d");
    expect(cells.get("B3")).toBe("b2");
  });

  it("escapes markup and keeps Arabic intact", () => {
    const cells = read(buildWorkbook("S", [["<a> & b", "وجدة"]]), "S");
    expect(cells.get("A1")).toBe("<a> & b");
    expect(cells.get("B1")).toBe("وجدة");
  });

  it("makes the sheet name legal", () => {
    const workbook = readWorkbook(buildWorkbook('A/B:"C"' + "x".repeat(40), [["v"]]));
    expect(workbook.sheets[0].name).toHaveLength(31);
    expect(workbook.sheets[0].name).not.toMatch(/[\/:"]/);
  });

  it("refuses a number a spreadsheet cannot hold", () => {
    expect(() => buildWorkbook("S", [[Number.NaN]])).toThrow();
  });

  it("marks a right-to-left sheet", () => {
    const zip = buildWorkbook("S", [["v"]], { rightToLeft: true });
    const sheet = readWorkbook(zip).entries.find((e) => e.name === "xl/worksheets/sheet1.xml")!;
    expect(sheet.data.toString()).toContain('rightToLeft="1"');
  });
});
