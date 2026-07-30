import type en from "@/lib/i18n/dictionaries/en";

/**
 * A deep-mutable, widened version of the English dictionary. Widening the
 * `as const` literals to `string` is what lets `fr` and `ar` supply their own
 * translations while still being checked for missing or extra keys.
 */
export type Dictionary = {
  [K in keyof typeof en]: {
    [K2 in keyof (typeof en)[K]]: (typeof en)[K][K2] extends string
      ? string
      : { [K3 in keyof (typeof en)[K][K2]]: string };
  };
};
