/**
 * The descriptors the configuration screens are generated from.
 *
 * There are fourteen configuration tables and they all need the same thing: a
 * table, a "new" dialog, an "edit" dialog and a delete confirmation. Writing
 * fourteen near-identical manager/dialog pairs would be four thousand lines that
 * drift apart the first time one of them is fixed, so a resource is described
 * once here and rendered by one generic manager.
 *
 * Pure data — no server imports, no React. The descriptors cross to the client,
 * where the dialog builds its form from them. Anything that needs the database
 * (scoping, relation choices) lives in `schema.server.ts` instead.
 */

/**
 * What a row belongs to. The one fact the whole configuration screen turns on:
 * it decides the `where` clause in resource-schema.ts, whether the year must be
 * set before the screen will render, and which of the two top tabs the resource
 * appears under.
 */
export type ResourceScope = "SCHOOL" | "YEAR";

/** How a field is edited and rendered. */
export type FieldType =
  | "text"
  | "textarea"
  | "number"
  /** Stored as integer centimes, entered and shown in dirhams. */
  | "money"
  /**
   * Stored as integer basis points, entered and shown as a percentage — the
   * same trick as `money`, for the same reason: a rate that decides what a
   * family owes or whether a child passed must not be a float.
   */
  | "percent"
  | "boolean"
  | "select"
  /**
   * Several of a fixed set of values, stored as one comma-joined string.
   * MySQL has no array type and a join table for "which days do you teach"
   * would be a table of at most seven small integers.
   */
  | "multiselect"
  /** A row from another resource, picked from a dropdown. */
  | "reference"
  /**
   * Several rows from another resource, held in a join table of their own.
   *
   * Not `multiselect` with ids in it: the values are foreign keys, and a niveau
   * that is renamed or deleted has to take its references with it, which a
   * comma-joined string of cuids cannot be made to do. The field's value
   * crosses to the client as the joined ids all the same — `ResourceRow` holds
   * primitives — but what is stored is rows. The join table is declared beside
   * the resource in resource-schema.ts.
   */
  | "multireference"
  | "color"
  /** Wall-clock "HH:MM". */
  | "time"
  | "date";

export type FieldDef = {
  name: string;
  type: FieldType;
  /** Key under `configuration.fields` in the dictionary. */
  labelKey: string;
  /** Key under `configuration.hints`. */
  hintKey?: string;
  required?: boolean;
  placeholder?: string;
  /** Force LTR for codes and times, which stay left-to-right even in Arabic. */
  dir?: "ltr";
  min?: number;
  max?: number;
  maxLength?: number;
  /** `select` only: allowed values, and the dictionary namespace for labels. */
  options?: readonly string[];
  /** Dictionary path under `configuration.options`, e.g. "roomKinds". */
  optionsKey?: string;
  /**
   * `select` only: the column behind it is an `Int`, so the posted string is
   * turned into a number before the write — see `coerceIntegerSelects`.
   * `TimeSlot.dayOfWeek` is the case: its options are "1".."7" and its column
   * is not a string.
   */
  integer?: boolean;
  /**
   * `reference` and `multireference` only: what to pick from. Either a resource
   * id, or one of the `@`-prefixed loaders in schema.server.ts (`@teachers`).
   */
  referenceTo?: string;
  /** Whether a blank value is accepted. Defaults to `!required`. */
  nullable?: boolean;
  defaultValue?: string | number | boolean;
  /** Show as a column in the table. */
  inTable?: boolean;
  /** Span both columns of the dialog grid. */
  wide?: boolean;
  /**
   * Singleton resources only: which fieldset this field sits under, as a key
   * under `configuration.groups`. A settings page with twelve controls in one
   * flat list is unreadable; a list resource's dialog ignores it.
   */
  groupKey?: string;
};

/** The module-specific controls a configuration screen may carry. */
export type ResourceHelper = "programme-carry-forward";

export type ResourceDef = {
  /** URL segment and lookup key, e.g. "levels". */
  id: string;
  /** Which top-level tab it sits under. */
  section: string;
  /** Key under `configuration.resources`. */
  labelKey: string;
  /**
   * What the rows belong to, and therefore which working context must be set
   * before the screen can do anything:
   *
   *   SCHOOL → scoped to `context.currentSchool`
   *   YEAR   → scoped to `context.currentSchoolYear`
   *
   * The generic query and the generic action both derive their `where` from
   * this, so a resource cannot accidentally read or write outside the context
   * the user has selected. The nav derives from it too — see `ScopeGroupDef`.
   */
  scope: ResourceScope;
  /**
   * Whether this resource is a list of rows or a single one.
   *
   * A singleton has exactly one row per scope — the school's own settings —
   * so it gets a form on the page rather than a table with an edit dialog,
   * and it has no create or delete. Defaults to `"list"`, which is what the
   * other fourteen resources are.
   */
  kind?: "list" | "singleton";
  /**
   * A module's own control, shown above the generic table.
   *
   * Named rather than imported, exactly as a nav icon is (see `NavIcon`): this
   * file crosses to the client and a component reference would drag a module's
   * server code with it. The name is resolved in
   * `components/resource-helper.tsx`, which is the only place that knows what a
   * helper actually renders.
   *
   * There is one, and it earns the extension: a year's programme is dozens of
   * rows nobody will retype every September, so the screen that manages it has
   * to offer the copy. Anything a *generic* table can do stays generic.
   */
  helper?: ResourceHelper;
  fields: FieldDef[];
  /** Fields joined with " — " to name a row in reference dropdowns. */
  labelFields: string[];
};

export type SectionDef = {
  id: string;
  /** Key under `configuration.sections`. */
  labelKey: string;
};

/**
 * The two top-level tabs the sections are clustered under — what belongs to the
 * establishment versus what is redrawn every September.
 *
 * A group holds no list of sections: it names a `scope`, and a resource appears
 * under it when `ResourceDef.scope` matches. That is the same field the `where`
 * clause is built from, so a screen is filed under the year exactly when its
 * rows really are the year's, and a new resource lands in the right tab without
 * anyone remembering to add it here. A section whose resources are of both
 * scopes — the fees, which are a catalogue on one side and a price list on the
 * other — simply appears under both, showing only that side's screens.
 */
export type ScopeGroupDef = {
  id: string;
  /** Key under `configuration.scopeGroups`. */
  labelKey: string;
  scope: ResourceScope;
};

/** One row as the client sees it: primitives only, ready to serialise. */
export type ResourceRow = {
  id: string;
  [field: string]: string | number | boolean | null;
};

/**
 * A choice in a reference dropdown.
 *
 * `group` is the heading it is listed under. Optional because most references
 * are a flat list of a dozen rows; the levels are not — see
 * modules/academics/labels.ts for why a niveau is unpickable without its cycle
 * above it.
 */
export type Choice = { id: string; label: string; group?: string };
