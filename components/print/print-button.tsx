"use client";

import { PrinterIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Hands the page to the browser's print dialog, where "Save as PDF" is the
 * default destination on every desktop platform.
 *
 * That is the download: the file the user gets is laid out by the same engine
 * that drew what they are looking at, so there is no second rendering path to
 * keep in step — and Arabic comes out shaped and right-to-left, which is the
 * part a PDF library would charge a lot of work for.
 */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button onClick={() => window.print()} size="sm">
      <PrinterIcon />
      {label}
    </Button>
  );
}
