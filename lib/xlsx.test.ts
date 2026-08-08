import { describe, expect, it } from "vitest";
import { deflateRawSync } from "node:zlib";

import { readZip } from "@/lib/xlsx";

/**
 * The zip reader, against files it did not write.
 *
 * Everything this parses arrives as an upload. A MASSAR workbook is somebody
 * else's file by definition, so the reader's job is not only to understand a
 * well-formed archive but to refuse a malformed or hostile one without taking
 * the server down with it.
 */

/** Builds a single-entry zip by hand, so the tests can make malformed ones. */
function zipOf({
  name = "xl/worksheets/sheet1.xml",
  payload,
  method = 8,
  declaredCompressedSize,
  entryCount = 1,
}: {
  name?: string;
  payload: Buffer;
  method?: number;
  declaredCompressedSize?: number;
  entryCount?: number;
}): Buffer {
  const nameBuffer = Buffer.from(name, "utf8");
  const body = method === 8 ? deflateRawSync(payload, { level: 9 }) : payload;
  const compressedSize = declaredCompressedSize ?? body.length;

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(compressedSize, 18);
  local.writeUInt32LE(payload.length, 22);
  local.writeUInt16LE(nameBuffer.length, 26);
  const localBlock = Buffer.concat([local, nameBuffer, body]);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(compressedSize, 20);
  central.writeUInt32LE(payload.length, 24);
  central.writeUInt16LE(nameBuffer.length, 28);
  central.writeUInt32LE(0, 42);
  const centralBlock = Buffer.concat([central, nameBuffer]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entryCount, 8);
  eocd.writeUInt16LE(entryCount, 10);
  eocd.writeUInt32LE(centralBlock.length, 12);
  eocd.writeUInt32LE(localBlock.length, 16);

  return Buffer.concat([localBlock, centralBlock, eocd]);
}

describe("readZip", () => {
  it("reads back a deflated entry", () => {
    const payload = Buffer.from("<sheetData><row r=\"1\"/></sheetData>", "utf8");
    const entries = readZip(zipOf({ payload }));

    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe("xl/worksheets/sheet1.xml");
    expect(entries[0]!.data.toString("utf8")).toBe(payload.toString("utf8"));
  });

  it("reads back a stored (uncompressed) entry", () => {
    const payload = Buffer.from("plain", "utf8");
    const entries = readZip(zipOf({ payload, method: 0 }));
    expect(entries[0]!.data.toString("utf8")).toBe("plain");
  });

  it("refuses an archive that expands beyond what it will hold", () => {
    // The zip bomb. Deflate reaches about 1030:1 on a run of zeros, so the 5 MB
    // the import actions accept is five gigabytes of allocation if nothing
    // bounds it — a school's server killed by a file of a few hundred KB.
    // `maxOutputLength` makes zlib stop rather than allocate what the header
    // asks for, so the size of the answer stays our choice and not the
    // uploader's.
    const bomb = zipOf({ payload: Buffer.alloc(96 * 1024 * 1024, 0) });

    expect(bomb.length).toBeLessThan(1024 * 1024);
    expect(() => readZip(bomb)).toThrow();
  });

  it("still accepts a workbook far larger than any real mark sheet", () => {
    // The cap must not be so tight that a genuine file trips it. A MASSAR
    // export is tens of kilobytes; this is a megabyte of markup.
    const real = Buffer.from("<row>ok</row>".repeat(80_000), "utf8");
    const entries = readZip(zipOf({ payload: real }));
    expect(entries[0]!.data.length).toBe(real.length);
  });

  it("refuses a file that is not a zip at all", () => {
    expect(() => readZip(Buffer.from("this is a CSV, actually", "utf8"))).toThrow(
      /no end-of-central-directory/i,
    );
  });

  it("refuses an empty buffer", () => {
    expect(() => readZip(Buffer.alloc(0))).toThrow();
  });

  it("refuses a compression method it does not implement", () => {
    // Not silently returning the raw bytes: a caller would then parse
    // compressed data as XML and report a confusing failure instead of this one.
    const payload = Buffer.from("x", "utf8");
    expect(() => readZip(zipOf({ payload, method: 14 }))).toThrow(
      /compression method/i,
    );
  });

  it("refuses a truncated archive rather than reading past the end", () => {
    const payload = Buffer.from("<sheetData/>", "utf8");
    const whole = zipOf({ payload });
    // Keep the trailer so the record is found, then cut out the middle.
    const truncated = Buffer.concat([
      whole.subarray(0, 20),
      whole.subarray(whole.length - 22),
    ]);
    expect(() => readZip(truncated)).toThrow();
  });

  it("refuses a central directory that lies about where an entry starts", () => {
    const payload = Buffer.from("<sheetData/>", "utf8");
    const zip = zipOf({ payload });
    // Point the entry's local header offset into the middle of the payload.
    const centralStart = zip.readUInt32LE(zip.length - 22 + 16);
    zip.writeUInt32LE(12, centralStart + 42);

    expect(() => readZip(zip)).toThrow(/local file header/i);
  });

  it("refuses ZIP64 rather than misreading its escape values", () => {
    const payload = Buffer.from("<sheetData/>", "utf8");
    const zip = zipOf({ payload });
    const centralStart = zip.readUInt32LE(zip.length - 22 + 16);
    zip.writeUInt32LE(0xffffffff, centralStart + 20);

    expect(() => readZip(zip)).toThrow(/ZIP64/i);
  });

  it("does not follow a traversing entry name anywhere", () => {
    // Nothing is written to disk — entries are matched by name in memory — so a
    // traversing name is data rather than a path. This pins that it stays data.
    const payload = Buffer.from("<sheetData/>", "utf8");
    const entries = readZip(
      zipOf({ payload, name: "../../../etc/passwd" }),
    );
    expect(entries[0]!.name).toBe("../../../etc/passwd");
    expect(entries[0]!.data.toString("utf8")).toBe("<sheetData/>");
  });
});
