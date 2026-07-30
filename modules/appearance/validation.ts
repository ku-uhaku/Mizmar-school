import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import { enumField } from "@/lib/validation";
import {
  ACCENTS,
  FONT_FAMILIES,
  FONT_SIZES,
  RADII,
  THEME_MODES,
} from "@/modules/appearance/enums";

/** Built per-request from the dictionary so messages are localised. */
export function appearanceSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    mode: enumField(THEME_MODES, v),
    accent: enumField(ACCENTS, v),
    fontFamily: enumField(FONT_FAMILIES, v),
    fontSize: enumField(FONT_SIZES, v),
    radius: enumField(RADII, v),
  });
}
