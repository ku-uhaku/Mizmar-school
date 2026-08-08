import { describe, expect, it } from "vitest";

import { pageWindow } from "@/lib/pagination";

/**
 * The page numbers under a table.
 *
 * The edges are the whole point: a control that reads `1 … 2 3 4 … 23` has an
 * ellipsis hiding nothing, and one that drops the last page leaves a reader
 * with no way to reach the end of a long list.
 */
describe("pageWindow", () => {
  it("lists every page when they all fit", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps both ends and a run around the reader", () => {
    expect(pageWindow(12, 23)).toEqual([1, "gap", 11, 12, 13, "gap", 23]);
  });

  it("never draws an ellipsis over a single page", () => {
    // 1 … 3 4 5 … 23 would hide page 2 behind a gap no shorter than the number.
    expect(pageWindow(4, 23)).toEqual([1, 2, 3, 4, 5, "gap", 23]);
    expect(pageWindow(20, 23)).toEqual([1, "gap", 19, 20, 21, 22, 23]);
  });

  it("holds at the ends", () => {
    expect(pageWindow(1, 23)).toEqual([1, 2, "gap", 23]);
    expect(pageWindow(23, 23)).toEqual([1, "gap", 22, 23]);
  });

  it("clamps a page number from outside the range", () => {
    expect(pageWindow(0, 23)).toEqual(pageWindow(1, 23));
    expect(pageWindow(99, 23)).toEqual(pageWindow(23, 23));
  });

  it("has nothing to draw for an empty table", () => {
    expect(pageWindow(1, 0)).toEqual([]);
  });
});
