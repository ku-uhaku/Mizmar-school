"use client";

import * as React from "react";

import { localKey } from "@/lib/local-key";
import type { SchoolSettingsValues } from "@/lib/school-settings";
import type { EducationCycle, LevelNomenclature } from "@/modules/academics/enums";
import { termNamesFor, termSpans } from "@/modules/school-years/presets";
import { DISCOUNTS, FEE_TYPES } from "@/modules/billing/presets";
import {
  classCodesFor,
  DEFAULT_NOMENCLATURE,
  levelsFor,
  programmeFor,
  subjectsFor,
  suggestedFeeAmount,
  suggestedRooms,
  tracksFor,
} from "@/modules/setup/catalogue";
import type { SetupSnapshot } from "@/modules/setup/queries";

/**
 * Every answer the wizard is holding, and everything derived from it.
 *
 * One hook rather than state scattered through twelve step components, because
 * the steps are not independent: ticking a cycle decides which levels exist,
 * which decides the filières, which decides the programme, which decides the
 * classes and which labs the room list needs. Keeping the graph in one place is
 * what lets each step stay a rendering of it.
 *
 * Nothing here is a form value in the DOM sense — the steps render this state as
 * hidden inputs at submit time, so a step that is switched off simply renders
 * none and the server sees an empty array.
 */

export type Draft<T> = T & { key: string };

export type CustomLevelDraft = Draft<{
  cycle: string;
  code: string;
  name: string;
  nameAr: string;
  gradeYear: string;
}>;

export type ProgrammeDraft = {
  levelCode: string;
  trackCode: string | null;
  subjectCode: string;
  coefficient: string;
  weeklyMinutes: string;
  included: boolean;
};

export type RoomDraft = Draft<{
  code: string;
  name: string;
  kind: string;
  building: string;
  floor: string;
  capacity: string;
}>;

export type OfferingDraft = {
  levelCode: string;
  trackCode: string | null;
  classCount: string;
  capacity: string;
};

export type FeeDraft = Draft<{
  included: boolean;
  code: string;
  name: string;
  nameAr: string;
  kind: string;
  billingCycle: string;
  isMandatory: boolean;
  amount: string;
}>;

export type RateDraft = Draft<{
  feeCode: string;
  levelCode: string;
  amount: string;
}>;

export type DiscountDraft = Draft<{
  included: boolean;
  code: string;
  name: string;
  nameAr: string;
  kind: string;
  percent: string;
  amount: string;
  reason: string;
  feeCode: string;
  isStackable: boolean;
}>;

export type TermDraft = Draft<{
  number: string;
  name: string;
  nameAr: string;
  startDate: string;
  endDate: string;
}>;

/** The steps that can be switched off. Identity and review cannot. */
export type SkippableStep =
  | "year"
  | "cycles"
  | "rooms"
  | "bell"
  | "classes"
  | "fees";

export type SetupMode = "new" | "existing";

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Capacity a level of this cycle usually seats. */
function defaultCapacity(cycle: EducationCycle): number {
  return cycle === "PRESCHOOL" ? 24 : cycle === "PRIMARY" ? 30 : 36;
}

export function useSetupState(input: {
  mode: SetupMode;
  snapshot: SetupSnapshot | null;
  settings: SchoolSettingsValues;
}) {
  const { snapshot } = input;

  // ── Which steps are switched on ────────────────────────────────────────────
  const [enabled, setEnabled] = React.useState<Record<SkippableStep, boolean>>({
    year: true,
    cycles: true,
    rooms: true,
    bell: true,
    classes: true,
    fees: true,
  });
  const toggleStep = React.useCallback((step: SkippableStep, value: boolean) => {
    setEnabled((current) => ({ ...current, [step]: value }));
  }, []);

  // ── The year ───────────────────────────────────────────────────────────────
  const defaultYear = React.useMemo(() => {
    // The year after the latest one the school already has, so a re-run offers
    // the next rentrée rather than the one being taught.
    const latest = snapshot?.years[0];
    const startYear = latest
      ? new Date(latest.startDate).getFullYear() + 1
      : new Date().getFullYear();
    return {
      name: `${startYear}-${startYear + 1}`,
      start: `${startYear}-09-01`,
      end: `${startYear + 1}-06-30`,
    };
  }, [snapshot]);

  const [yearName, setYearName] = React.useState(defaultYear.name);
  const [yearStart, setYearStart] = React.useState(defaultYear.start);
  const [yearEnd, setYearEnd] = React.useState(defaultYear.end);
  const [yearStatus, setYearStatus] = React.useState("ACTIVE");
  const [yearIsDefault, setYearIsDefault] = React.useState(true);
  const [withHolidays, setWithHolidays] = React.useState(true);
  const [termCount, setTermCount] = React.useState(2);
  const [termEdits, setTermEdits] = React.useState<
    Record<number, Partial<Omit<TermDraft, "key" | "number">>>
  >({});

  /**
   * The terms, dated by splitting the year evenly — and re-dated whenever the
   * year or the split changes, because a term that kept last answer's dates
   * would silently sit outside its own year.
   *
   * Derived rather than stored, so nothing has to notice the change: a date the
   * user typed lives in `termEdits` and wins over the split, and everything
   * else follows the year.
   */
  const terms = React.useMemo<TermDraft[]>(() => {
    const start = new Date(yearStart);
    const end = new Date(yearEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return [];
    }

    const spans = termSpans(start, end, termCount);
    return termNamesFor(termCount)
      .slice(0, termCount)
      .map((term, index) => {
        const edit = termEdits[term.number] ?? {};
        return {
          key: `term-${term.number}`,
          number: String(term.number),
          name: edit.name ?? term.name,
          nameAr: edit.nameAr ?? term.nameAr,
          startDate: edit.startDate ?? toDateInput(spans[index].start),
          endDate: edit.endDate ?? toDateInput(spans[index].end),
        };
      });
  }, [yearStart, yearEnd, termCount, termEdits]);

  const updateTerm = React.useCallback(
    (number: string, patch: Partial<Omit<TermDraft, "key" | "number">>) => {
      setTermEdits((current) => ({
        ...current,
        [Number(number)]: { ...current[Number(number)], ...patch },
      }));
    },
    [],
  );

  // ── The cursus ─────────────────────────────────────────────────────────────
  const [cycles, setCycles] = React.useState<EducationCycle[]>(
    () => (snapshot?.cycles ?? []) as EducationCycle[],
  );

  /*
    Levels, filières and subjects hold what the school *unticked*, not what it
    ticked. Everything the catalogue offers is on by default, so a filière that
    becomes reachable because a level was just added arrives ticked without
    anything having to notice — and an explicit untick survives every later
    change to the cycles. Storing the inclusions instead needed an effect to
    tick each newly reachable row, which is a cascading render and, worse, could
    not tell "not chosen yet" from "deliberately removed".
  */
  /**
   * What the school calls its primary years — 1AP…6AP, or CP…6ème.
   *
   * Part of the cursus rather than the identity step because it decides what
   * every step below is looking at: the level codes it changes are the same
   * ones the programme, the classes and the price list are keyed by.
   */
  const [nomenclature, setNomenclature] =
    React.useState<LevelNomenclature>(DEFAULT_NOMENCLATURE);

  const [excludedLevels, setExcludedLevels] = React.useState<string[]>([]);
  const [excludedTracks, setExcludedTracks] = React.useState<string[]>([]);
  const [excludedSubjects, setExcludedSubjects] = React.useState<string[]>([]);

  const [customLevels, setCustomLevels] = React.useState<CustomLevelDraft[]>([]);

  const toggleCycle = React.useCallback((cycle: EducationCycle, on: boolean) => {
    setCycles((current) =>
      on
        ? [...current.filter((item) => item !== cycle), cycle]
        : current.filter((item) => item !== cycle),
    );
  }, []);

  /**
   * Switching the naming carries the ticks across rather than resetting them.
   *
   * The two lists are the same six years, so a school that unticked its sixth
   * year and then changed its mind about the naming means the same thing
   * afterwards. Remapping by position is what says so; dropping the exclusions
   * would silently re-tick a level they had removed.
   */
  const chooseNomenclature = React.useCallback((next: LevelNomenclature) => {
    setNomenclature((current) => {
      if (current === next) return current;
      const from = levelsFor(["PRIMARY"], current);
      const to = levelsFor(["PRIMARY"], next);
      setExcludedLevels((excluded) =>
        excluded.map((code) => {
          const index = from.findIndex((level) => level.code === code);
          return index === -1 ? code : to[index].code;
        }),
      );
      return next;
    });
  }, []);

  const catalogueLevels = React.useMemo(
    () => levelsFor(cycles, nomenclature),
    [cycles, nomenclature],
  );
  const levelCodes = React.useMemo(
    () =>
      catalogueLevels
        .filter((level) => !excludedLevels.includes(level.code))
        .map((level) => level.code),
    [catalogueLevels, excludedLevels],
  );

  const toggleLevel = React.useCallback((code: string, on: boolean) => {
    setExcludedLevels((current) =>
      on ? current.filter((item) => item !== code) : [...new Set([...current, code])],
    );
  }, []);
  const toggleLevels = React.useCallback((codes: readonly string[], on: boolean) => {
    setExcludedLevels((current) =>
      on
        ? current.filter((item) => !codes.includes(item))
        : [...new Set([...current, ...codes])],
    );
  }, []);

  const chosenLevelCodes = React.useMemo(
    () => [
      ...levelCodes,
      ...customLevels.filter((row) => row.code.trim()).map((row) => row.code.toUpperCase()),
    ],
    [levelCodes, customLevels],
  );

  const catalogueTracks = React.useMemo(
    () => tracksFor(chosenLevelCodes),
    [chosenLevelCodes],
  );
  const trackCodes = React.useMemo(
    () =>
      catalogueTracks
        .filter((track) => !excludedTracks.includes(track.code))
        .map((track) => track.code),
    [catalogueTracks, excludedTracks],
  );
  const toggleTrack = React.useCallback((code: string, on: boolean) => {
    setExcludedTracks((current) =>
      on ? current.filter((item) => item !== code) : [...new Set([...current, code])],
    );
  }, []);
  const reachableTrackCodes = trackCodes;

  const cataloguePolicy = React.useMemo(
    () => programmeFor(chosenLevelCodes, reachableTrackCodes, nomenclature),
    [chosenLevelCodes, reachableTrackCodes, nomenclature],
  );

  const catalogueSubjects = React.useMemo(
    () => subjectsFor(cataloguePolicy),
    [cataloguePolicy],
  );
  const chosenSubjectCodes = React.useMemo(
    () =>
      catalogueSubjects
        .filter((subject) => !excludedSubjects.includes(subject.code))
        .map((subject) => subject.code),
    [catalogueSubjects, excludedSubjects],
  );
  const toggleSubjects = React.useCallback((codes: readonly string[], on: boolean) => {
    setExcludedSubjects((current) =>
      on
        ? current.filter((item) => !codes.includes(item))
        : [...new Set([...current, ...codes])],
    );
  }, []);

  // ── The programme ──────────────────────────────────────────────────────────
  const [programmeEdits, setProgrammeEdits] = React.useState<
    Record<string, { coefficient?: string; weeklyMinutes?: string; included?: boolean }>
  >({});

  const programmeKey = (row: { levelCode: string; trackCode: string | null; subjectCode: string }) =>
    `${row.levelCode}|${row.trackCode ?? ""}|${row.subjectCode}`;

  const programme = React.useMemo<ProgrammeDraft[]>(
    () =>
      cataloguePolicy
        .filter((row) => chosenSubjectCodes.includes(row.subjectCode))
        .map((row) => {
          const edit = programmeEdits[programmeKey(row)] ?? {};
          return {
            levelCode: row.levelCode,
            trackCode: row.trackCode,
            subjectCode: row.subjectCode,
            coefficient: edit.coefficient ?? String(row.coefficient),
            weeklyMinutes: edit.weeklyMinutes ?? (row.weeklyMinutes ? String(row.weeklyMinutes) : ""),
            included: edit.included ?? true,
          };
        }),
    [cataloguePolicy, chosenSubjectCodes, programmeEdits],
  );

  const updateProgramme = React.useCallback(
    (
      row: { levelCode: string; trackCode: string | null; subjectCode: string },
      patch: { coefficient?: string; weeklyMinutes?: string; included?: boolean },
    ) => {
      const key = programmeKey(row);
      setProgrammeEdits((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
    },
    [],
  );

  // ── Classes ────────────────────────────────────────────────────────────────
  const [offeringEdits, setOfferingEdits] = React.useState<
    Record<string, { classCount?: string; capacity?: string }>
  >({});
  const [groupsPerClass, setGroupsPerClass] = React.useState("0");
  const [groupPurpose, setGroupPurpose] = React.useState("LAB");

  /** One row per level, and per filière where the level has them. */
  const offerings = React.useMemo<OfferingDraft[]>(() => {
    const rows: OfferingDraft[] = [];
    for (const level of catalogueLevels) {
      if (!levelCodes.includes(level.code)) continue;
      const levelTracks = catalogueTracks.filter(
        (track) => track.levelCode === level.code && reachableTrackCodes.includes(track.code),
      );
      const cycle = level.cycle as EducationCycle;
      const targets = levelTracks.length > 0 ? levelTracks.map((t) => t.code) : [null];
      for (const trackCode of targets) {
        const key = `${level.code}|${trackCode ?? ""}`;
        const edit = offeringEdits[key] ?? {};
        rows.push({
          levelCode: level.code,
          trackCode,
          classCount: edit.classCount ?? "1",
          capacity: edit.capacity ?? String(defaultCapacity(cycle)),
        });
      }
    }
    for (const custom of customLevels) {
      if (!custom.code.trim()) continue;
      const key = `${custom.code.toUpperCase()}|`;
      const edit = offeringEdits[key] ?? {};
      rows.push({
        levelCode: custom.code.toUpperCase(),
        trackCode: null,
        classCount: edit.classCount ?? "1",
        capacity: edit.capacity ?? "30",
      });
    }
    return rows;
  }, [catalogueLevels, levelCodes, catalogueTracks, reachableTrackCodes, offeringEdits, customLevels]);

  const updateOffering = React.useCallback(
    (levelCode: string, trackCode: string | null, patch: { classCount?: string; capacity?: string }) => {
      const key = `${levelCode}|${trackCode ?? ""}`;
      setOfferingEdits((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
    },
    [],
  );

  const classCount = React.useMemo(
    () => offerings.reduce((total, row) => total + (Number(row.classCount) || 0), 0),
    [offerings],
  );

  // ── Rooms ──────────────────────────────────────────────────────────────────
  const [rooms, setRooms] = React.useState<RoomDraft[] | null>(null);

  const suggested = React.useMemo(() => {
    const classCountByCycle: Partial<Record<EducationCycle, number>> = {};
    for (const row of offerings) {
      const level = catalogueLevels.find((item) => item.code === row.levelCode);
      const cycle = (level?.cycle ?? "PRIMARY") as EducationCycle;
      classCountByCycle[cycle] = (classCountByCycle[cycle] ?? 0) + (Number(row.classCount) || 0);
    }
    return suggestedRooms({ cycles, classCountByCycle, subjectCodes: chosenSubjectCodes });
  }, [offerings, catalogueLevels, cycles, chosenSubjectCodes]);

  // Suggested until the user touches the table, theirs from then on — so a room
  // they renamed is not overwritten by the next tick on the classes step.
  const roomRows = React.useMemo<RoomDraft[]>(
    () =>
      rooms ??
      suggested.map((room) => ({
        key: localKey("room"),
        code: room.code,
        name: room.name ?? "",
        kind: room.kind,
        building: room.building ?? "",
        floor: room.floor === undefined ? "" : String(room.floor),
        capacity: room.capacity === undefined ? "" : String(room.capacity),
      })),
    [rooms, suggested],
  );

  const updateRoom = React.useCallback((key: string, patch: Partial<RoomDraft>) => {
    setRooms((current) =>
      (current ?? []).map((room) => (room.key === key ? { ...room, ...patch } : room)),
    );
  }, []);

  const takeOverRooms = React.useCallback(() => {
    setRooms((current) => current ?? roomRows);
  }, [roomRows]);

  // ── The bell ───────────────────────────────────────────────────────────────
  const [bell, setBell] = React.useState({
    teachingDays: [1, 2, 3, 4, 5, 6],
    dayStartsAt: input.settings.dayStartsAt,
    afternoonStartsAt: input.settings.afternoonStartsAt,
    periodMinutes: String(input.settings.periodMinutes),
    morningPeriods: String(input.settings.morningPeriods),
    afternoonPeriods: String(input.settings.afternoonPeriods),
    periodsBeforeBreak: String(input.settings.periodsBeforeBreak),
    breakMinutes: String(input.settings.breakMinutes),
    saturdayMorningOnly: true,
    withRamadan: true,
    ramadanStartsAt: "09:00",
    ramadanPeriods: "4",
  });
  const patchBell = React.useCallback((patch: Partial<typeof bell>) => {
    setBell((current) => ({ ...current, ...patch }));
  }, []);

  // ── Billing ────────────────────────────────────────────────────────────────
  const [fees, setFees] = React.useState<FeeDraft[]>(() =>
    FEE_TYPES.map((fee) => ({
      key: localKey("fee"),
      included: fee.isMandatory,
      code: fee.code,
      name: fee.name,
      nameAr: fee.nameAr,
      kind: fee.kind,
      billingCycle: fee.billingCycle,
      isMandatory: fee.isMandatory,
      amount: String(suggestedFeeAmount(fee.code, null) ?? ""),
    })),
  );
  const updateFee = React.useCallback((key: string, patch: Partial<FeeDraft>) => {
    setFees((current) => current.map((fee) => (fee.key === key ? { ...fee, ...patch } : fee)));
  }, []);

  const [rates, setRates] = React.useState<RateDraft[] | null>(null);

  // The catalogue prices scolarité per level; everything else is flat. Offered
  // only for the levels the school actually chose.
  const suggestedRates = React.useMemo<RateDraft[]>(
    () =>
      chosenLevelCodes.flatMap((levelCode) => {
        const amount = suggestedFeeAmount("SCOLARITE", levelCode);
        if (amount === null) return [];
        return [{ key: localKey("rate"), feeCode: "SCOLARITE", levelCode, amount: String(amount) }];
      }),
    [chosenLevelCodes],
  );
  const rateRows = rates ?? suggestedRates;

  const updateRate = React.useCallback((key: string, patch: Partial<RateDraft>) => {
    setRates((current) =>
      (current ?? []).map((rate) => (rate.key === key ? { ...rate, ...patch } : rate)),
    );
  }, []);
  const takeOverRates = React.useCallback(() => {
    setRates((current) => current ?? rateRows);
  }, [rateRows]);

  const [discounts, setDiscounts] = React.useState<DiscountDraft[]>(() =>
    DISCOUNTS.map((discount) => ({
      key: localKey("discount"),
      included: true,
      code: discount.code,
      name: discount.name,
      nameAr: discount.nameAr,
      kind: discount.kind,
      percent: discount.percentBps ? String(discount.percentBps / 100) : "",
      amount: discount.dirhams ? String(discount.dirhams) : "",
      reason: discount.reason,
      feeCode: discount.feeCode ?? "",
      isStackable: discount.isStackable ?? false,
    })),
  );
  const updateDiscount = React.useCallback((key: string, patch: Partial<DiscountDraft>) => {
    setDiscounts((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }, []);

  const [currencyCode, setCurrencyCode] = React.useState(input.settings.currencyCode);
  const [defaultLocale, setDefaultLocale] = React.useState(input.settings.defaultLocale);
  const [instalmentCount, setInstalmentCount] = React.useState(
    String(input.settings.defaultInstalmentCount),
  );
  const [feeDueDay, setFeeDueDay] = React.useState(String(input.settings.feeDueDayOfMonth));

  // ── What the review step counts ────────────────────────────────────────────
  const summary = React.useMemo(() => {
    const on = (step: SkippableStep) => enabled[step];
    const cursusOn = on("cycles");
    const yearOn = on("year");
    const classesOn = on("classes") && yearOn;
    const feesOn = on("fees");

    const openedClasses = classesOn
      ? offerings.reduce(
          (total, row) =>
            total + classCodesFor(row.levelCode, row.trackCode, Number(row.classCount) || 0).length,
          0,
        )
      : 0;

    return {
      cycles: cursusOn ? cycles.length : 0,
      levels: cursusOn ? chosenLevelCodes.length : 0,
      tracks: cursusOn ? reachableTrackCodes.length : 0,
      subjects: cursusOn ? chosenSubjectCodes.length : 0,
      programme: cursusOn ? programme.filter((row) => row.included).length : 0,
      rooms: on("rooms") ? roomRows.filter((room) => room.code.trim()).length : 0,
      terms: yearOn ? terms.length : 0,
      offerings: classesOn ? offerings.filter((row) => Number(row.classCount) > 0).length : 0,
      classes: openedClasses,
      groups: openedClasses * (Number(groupsPerClass) || 0),
      feeTypes: feesOn ? fees.filter((fee) => fee.included).length : 0,
      feeRates: feesOn ? rateRows.filter((rate) => rate.amount.trim()).length : 0,
      discounts: feesOn ? discounts.filter((row) => row.included).length : 0,
    };
  }, [
    enabled, cycles, chosenLevelCodes, reachableTrackCodes, chosenSubjectCodes,
    programme, roomRows, terms, offerings, groupsPerClass, fees, rateRows, discounts,
  ]);

  return {
    mode: input.mode,
    snapshot,
    enabled,
    toggleStep,

    year: {
      name: yearName, setName: setYearName,
      start: yearStart, setStart: setYearStart,
      end: yearEnd, setEnd: setYearEnd,
      status: yearStatus, setStatus: setYearStatus,
      isDefault: yearIsDefault, setIsDefault: setYearIsDefault,
      withHolidays, setWithHolidays,
      termCount, setTermCount,
      terms, updateTerm,
    },

    cursus: {
      cycles, toggleCycle,
      nomenclature, chooseNomenclature,
      catalogueLevels, levelCodes, toggleLevel, toggleLevels,
      customLevels, setCustomLevels,
      chosenLevelCodes,
      catalogueTracks, trackCodes, toggleTrack, reachableTrackCodes,
      catalogueSubjects, chosenSubjectCodes, toggleSubjects,
      programme, updateProgramme,
    },

    rooms: { rows: roomRows, setRooms, updateRoom, takeOverRooms },

    bell: { ...bell, patch: patchBell },

    classes: {
      offerings, updateOffering, classCount,
      groupsPerClass, setGroupsPerClass,
      groupPurpose, setGroupPurpose,
    },

    fees: {
      rows: fees, updateFee,
      rates: rateRows, setRates, updateRate, takeOverRates,
      discounts, updateDiscount,
      currencyCode, setCurrencyCode,
      defaultLocale, setDefaultLocale,
      instalmentCount, setInstalmentCount,
      feeDueDay, setFeeDueDay,
    },

    summary,
  };
}

export type SetupState = ReturnType<typeof useSetupState>;
