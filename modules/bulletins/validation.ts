import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import { optionalEnumField, optionalText, requiredText } from "@/lib/validation";
import {
  APPRECIATION_MAX_LENGTH,
  COMMENT_MAX_LENGTH,
  COUNCIL_DECISIONS,
  MENTIONS,
} from "@/modules/bulletins/enums";

/** Built per-request from the dictionary so messages come back localised. */

/** Which class, and which term. Both ids are re-checked against the school. */
export function bulletinScopeSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    schoolClassId: requiredText(v, { max: 40 }),
    termId: requiredText(v, { max: 40 }),
  });
}

/**
 * A teacher's line about one pupil in one subject.
 *
 * The subject is not here: the line already knows which subject it is, and
 * accepting one would let a crafted POST move an appreciation onto a matière
 * the sender does not teach.
 */
export function appreciationSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    id: requiredText(v, { max: 40 }),
    appreciation: optionalText(APPRECIATION_MAX_LENGTH),
  });
}

/**
 * The council's decision.
 *
 * `status` is deliberately absent, exactly as it is on the supply list schema:
 * publishing is a separate action behind a separate permission, and accepting
 * it here would let somebody who may only award a mention issue the bulletin
 * with it.
 *
 * Both enums are optional because "no mention" and "not decided" are real
 * answers — a mention is awarded, not owed, and only the last term asks the
 * second question at all.
 */
export function councilSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    id: requiredText(v, { max: 40 }),
    mention: optionalEnumField(MENTIONS, v),
    decision: optionalEnumField(COUNCIL_DECISIONS, v),
    councilComment: optionalText(COMMENT_MAX_LENGTH),
    mainTeacherComment: optionalText(COMMENT_MAX_LENGTH),
  });
}
