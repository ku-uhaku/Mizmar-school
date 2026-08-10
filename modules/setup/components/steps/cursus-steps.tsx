"use client";

import * as React from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { interpolate } from "@/lib/i18n/format";
import { localKey } from "@/lib/local-key";
import {
  EDUCATION_CYCLES,
  LEVEL_NOMENCLATURES,
  type EducationCycle,
  type LevelNomenclature,
} from "@/modules/academics/enums";
import { cycleEntry, SETUP_CYCLES, trackByCode } from "@/modules/setup/catalogue";
import { CheckRow } from "@/modules/setup/components/step-shell";
import type { SetupState } from "@/modules/setup/components/use-setup-state";

/** Tick the cycles the school runs. Every step below follows from this one. */
export function CyclesStep({ setup }: { setup: SetupState }) {
  const t = useT();
  const already = new Set(setup.snapshot?.cycles ?? []);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {SETUP_CYCLES.map((cycle) => {
        const entry = cycleEntry(cycle, setup.cursus.nomenclature);
        return (
          <CheckRow
            key={cycle}
            id={`cycle-${cycle}`}
            name="cycle"
            value={cycle}
            checked={setup.cursus.cycles.includes(cycle)}
            onCheckedChange={(checked) => setup.cursus.toggleCycle(cycle, checked)}
            label={entry.name}
            hint={
              <span dir="rtl" className="block text-start">
                {entry.nameAr}
              </span>
            }
            badges={
              <>
                <Badge variant="secondary">
                  {interpolate(t.setup.cursus.levelCount, { count: entry.levels.length })}
                </Badge>
                {entry.tracks.length > 0 ? (
                  <Badge variant="secondary">
                    {interpolate(t.setup.cursus.trackCount, { count: entry.tracks.length })}
                  </Badge>
                ) : null}
                {already.has(cycle) ? (
                  <Badge variant="outline">{t.setup.cursus.alreadyRuns}</Badge>
                ) : null}
              </>
            }
          />
        );
      })}
    </div>
  );
}

export function LevelsStep({ setup }: { setup: SetupState }) {
  const t = useT();
  const already = new Set(setup.snapshot?.levelCodes ?? []);

  const byCycle = SETUP_CYCLES.filter((cycle) => setup.cursus.cycles.includes(cycle));

  return (
    <div className="grid gap-6">
      {byCycle.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t.setup.nothingChosen}</p>
      ) : null}

      {/*
        Only worth asking a school that runs a primaire: the collège and the
        baccalauréat are called the same thing everywhere.
      */}
      {byCycle.includes("PRIMARY") ? (
        <section className="grid gap-2 rounded-lg border p-3">
          <div className="grid gap-0.5">
            <h3 className="text-sm font-semibold">{t.setup.cursus.nomenclature}</h3>
            <p className="text-muted-foreground text-xs">
              {t.setup.cursus.nomenclatureHint}
            </p>
          </div>

          <Tabs
            value={setup.cursus.nomenclature}
            onValueChange={(value) =>
              setup.cursus.chooseNomenclature(value as LevelNomenclature)
            }
          >
            <TabsList>
              {LEVEL_NOMENCLATURES.map((option) => (
                <TabsTrigger key={option} value={option}>
                  {option === "FRENCH"
                    ? t.setup.cursus.nomenclatureFrench
                    : t.setup.cursus.nomenclatureMoroccan}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </section>
      ) : null}

      {byCycle.map((cycle) => {
        const entry = cycleEntry(cycle, setup.cursus.nomenclature);
        const codes = entry.levels.map((level) => level.code);
        const allOn = codes.every((code) => setup.cursus.levelCodes.includes(code));

        return (
          <section key={cycle} className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{entry.name}</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setup.cursus.toggleLevels(codes, !allOn)}
              >
                {allOn ? t.setup.selectNone : t.setup.selectAll}
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {entry.levels.map((level) => (
                <CheckRow
                  key={level.code}
                  id={`level-${level.code}`}
                  name="levelCode"
                  value={level.code}
                  checked={setup.cursus.levelCodes.includes(level.code)}
                  onCheckedChange={(checked) => setup.cursus.toggleLevel(level.code, checked)}
                  label={level.name}
                  hint={
                    <span dir="rtl" className="block text-start">
                      {level.nameAr}
                    </span>
                  }
                  badges={
                    <>
                      <Badge variant="secondary">{level.code}</Badge>
                      {already.has(level.code) ? (
                        <Badge variant="outline">{t.setup.cursus.alreadyRuns}</Badge>
                      ) : null}
                    </>
                  }
                />
              ))}
            </div>
          </section>
        );
      })}

      <CustomLevels setup={setup} />
    </div>
  );
}

function CustomLevels({ setup }: { setup: SetupState }) {
  const t = useT();
  const rows = setup.cursus.customLevels;

  return (
    <section className="grid gap-3 rounded-lg border border-dashed p-4">
      <div>
        <h3 className="text-sm font-semibold">{t.setup.cursus.addLevel}</h3>
        <p className="text-muted-foreground text-xs">{t.setup.cursus.customLevelHint}</p>
      </div>

      {rows.map((row) => (
        <div key={row.key} className="grid gap-2 sm:grid-cols-[10rem_1fr_1fr_7rem_auto]">
          <Select
            value={row.cycle}
            onValueChange={(value) =>
              setup.cursus.setCustomLevels((current) =>
                current.map((item) => (item.key === row.key ? { ...item, cycle: value } : item)),
              )
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EDUCATION_CYCLES.map((cycle) => (
                <SelectItem key={cycle} value={cycle}>
                  {cycleEntry(cycle as EducationCycle, setup.cursus.nomenclature).name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            aria-label={t.setup.cursus.levelCode}
            placeholder={t.setup.cursus.levelCode}
            value={row.code}
            className="uppercase"
            dir="ltr"
            onChange={(event) =>
              setup.cursus.setCustomLevels((current) =>
                current.map((item) =>
                  item.key === row.key ? { ...item, code: event.target.value } : item,
                ),
              )
            }
          />
          <Input
            aria-label={t.setup.cursus.levelName}
            placeholder={t.setup.cursus.levelName}
            value={row.name}
            onChange={(event) =>
              setup.cursus.setCustomLevels((current) =>
                current.map((item) =>
                  item.key === row.key ? { ...item, name: event.target.value } : item,
                ),
              )
            }
          />
          <Input
            aria-label={t.setup.cursus.gradeYear}
            type="number"
            min={1}
            max={12}
            value={row.gradeYear}
            onChange={(event) =>
              setup.cursus.setCustomLevels((current) =>
                current.map((item) =>
                  item.key === row.key ? { ...item, gradeYear: event.target.value } : item,
                ),
              )
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t.setup.removeRow}
            onClick={() =>
              setup.cursus.setCustomLevels((current) =>
                current.filter((item) => item.key !== row.key),
              )
            }
          >
            <Trash2Icon className="size-4" />
          </Button>
        </div>
      ))}

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setup.cursus.setCustomLevels((current) => [
              ...current,
              {
                key: localKey("level"),
                cycle: setup.cursus.cycles[0] ?? "PRIMARY",
                code: "",
                name: "",
                nameAr: "",
                gradeYear: "1",
              },
            ])
          }
        >
          <PlusIcon className="size-4" />
          {t.setup.addRow}
        </Button>
      </div>
    </section>
  );
}

export function TracksStep({ setup }: { setup: SetupState }) {
  const t = useT();
  const tracks = setup.cursus.catalogueTracks;

  if (tracks.length === 0) {
    return <p className="text-muted-foreground text-sm">{t.setup.cursus.noTracks}</p>;
  }

  const levels = [...new Set(tracks.map((track) => track.levelCode))];

  return (
    <div className="grid gap-6">
      {levels.map((levelCode) => (
        <section key={levelCode} className="grid gap-3">
          <h3 className="text-sm font-semibold">{levelCode}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {tracks
              .filter((track) => track.levelCode === levelCode)
              .map((track) => (
                <CheckRow
                  key={track.code}
                  id={`track-${track.code}`}
                  name="trackCode"
                  value={track.code}
                  checked={setup.cursus.trackCodes.includes(track.code)}
                  onCheckedChange={(checked) => setup.cursus.toggleTrack(track.code, checked)}
                  label={track.name}
                  hint={
                    <span dir="rtl" className="block text-start">
                      {track.nameAr}
                    </span>
                  }
                  badges={<Badge variant="secondary">{track.code}</Badge>}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function SubjectsStep({ setup }: { setup: SetupState }) {
  const t = useT();
  const subjects = setup.cursus.catalogueSubjects;

  if (subjects.length === 0) {
    return <p className="text-muted-foreground text-sm">{t.setup.nothingChosen}</p>;
  }

  const parents = subjects.filter((subject) => !subject.parent);

  /** Ticking a parent brings its components; unticking takes them away. */
  function toggleSubject(code: string, checked: boolean) {
    const children = subjects.filter((s) => s.parent === code).map((s) => s.code);
    setup.cursus.toggleSubjects([code, ...children], checked);
  }

  return (
    <div className="grid gap-3">
      {parents.map((subject) => {
        const children = subjects.filter((item) => item.parent === subject.code);
        return (
          <div key={subject.code} className="grid gap-2">
            <CheckRow
              id={`subject-${subject.code}`}
              name="subjectCode"
              value={subject.code}
              checked={setup.cursus.chosenSubjectCodes.includes(subject.code)}
              onCheckedChange={(checked) => toggleSubject(subject.code, checked)}
              label={subject.name}
              badges={
                <>
                  <Badge variant="secondary">{subject.code}</Badge>
                  {subject.isLanguage ? (
                    <Badge variant="outline">{t.setup.cursus.language}</Badge>
                  ) : null}
                  {subject.requiresLab ? (
                    <Badge variant="outline">{t.setup.cursus.requiresLab}</Badge>
                  ) : null}
                </>
              }
            />

            {children.length > 0 ? (
              <div className="ms-8 grid gap-2 sm:grid-cols-2">
                {children.map((child) => (
                  <CheckRow
                    key={child.code}
                    id={`subject-${child.code}`}
                    name="subjectCode"
                    value={child.code}
                    checked={setup.cursus.chosenSubjectCodes.includes(child.code)}
                    onCheckedChange={(checked) => setup.cursus.toggleSubjects([child.code], checked)}
                    label={child.name}
                    badges={<Badge variant="outline">{t.setup.cursus.componentSubject}</Badge>}
                    className="hover:bg-muted/40 flex cursor-pointer items-start gap-3 rounded-lg border border-dashed p-2"
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The coefficient and weekly load of every subject, level by level.
 *
 * One tab per level rather than one long table: a coefficient is only ever read
 * against the other subjects of the same level, and a 180-row table is not a
 * thing anybody checks.
 */
export function ProgrammeStep({ setup }: { setup: SetupState }) {
  const t = useT();
  const rows = setup.cursus.programme;
  const levels = React.useMemo(
    () => [...new Set(rows.map((row) => row.levelCode))],
    [rows],
  );
  const [active, setActive] = React.useState<string | null>(null);
  const current = active && levels.includes(active) ? active : (levels[0] ?? null);

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">{t.setup.cursus.noProgramme}</p>;
  }

  const visible = rows.filter((row) => row.levelCode === current);
  const total = visible
    .filter((row) => row.included)
    .reduce((sum, row) => sum + (Number(row.coefficient) || 0), 0);

  return (
    <div className="grid gap-4">
      <Tabs value={current ?? undefined} onValueChange={setActive}>
        <TabsList variant="line">
          {levels.map((levelCode) => (
            <TabsTrigger key={levelCode} value={levelCode}>
              {levelCode}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-2">
        {visible.map((row) => {
          const track = row.trackCode ? trackByCode(row.trackCode) : null;
          const id = `prog-${row.levelCode}-${row.trackCode ?? "all"}-${row.subjectCode}`;
          return (
            <div
              key={id}
              className="grid items-center gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_8rem_9rem_6rem]"
            >
              <div className="grid gap-0.5">
                <span className="text-sm font-medium">{row.subjectCode}</span>
                <span className="text-muted-foreground text-xs">
                  {track ? track.name : t.setup.cursus.allTracks}
                </span>
              </div>

              <Input
                aria-label={t.setup.cursus.coefficient}
                type="number"
                min={1}
                max={20}
                value={row.coefficient}
                disabled={!row.included}
                onChange={(event) =>
                  setup.cursus.updateProgramme(row, { coefficient: event.target.value })
                }
              />
              <Input
                aria-label={t.setup.cursus.weeklyMinutes}
                type="number"
                min={0}
                value={row.weeklyMinutes}
                disabled={!row.included}
                onChange={(event) =>
                  setup.cursus.updateProgramme(row, { weeklyMinutes: event.target.value })
                }
              />
              <label className="flex items-center gap-2 text-sm font-normal">
                <input
                  type="checkbox"
                  className="accent-primary size-4"
                  checked={row.included}
                  onChange={(event) =>
                    setup.cursus.updateProgramme(row, { included: event.target.checked })
                  }
                />
                {t.setup.cursus.include}
              </label>
            </div>
          );
        })}
      </div>

      <p className="text-muted-foreground text-sm">
        {interpolate(t.setup.cursus.totalCoefficient, { total })}
      </p>
    </div>
  );
}

/**
 * The programme's hidden inputs — six parallel arrays, one value per row in
 * every one of them.
 *
 * A row that is not taught still occupies its slot, carrying `progIncluded=0`,
 * because the arrays are zipped by index on the server: a row that rendered
 * five of its six inputs would shift every later coefficient onto the wrong
 * subject.
 */
export function ProgrammeInputs({ setup }: { setup: SetupState }) {
  return (
    <>
      {setup.cursus.programme.map((row) => {
        const key = `${row.levelCode}|${row.trackCode ?? ""}|${row.subjectCode}`;
        return (
          <React.Fragment key={key}>
            <input type="hidden" name="progLevelCode" value={row.levelCode} />
            <input type="hidden" name="progTrackCode" value={row.trackCode ?? ""} />
            <input type="hidden" name="progSubjectCode" value={row.subjectCode} />
            <input type="hidden" name="progCoefficient" value={row.coefficient} />
            <input type="hidden" name="progWeeklyMinutes" value={row.weeklyMinutes} />
            <input type="hidden" name="progIncluded" value={row.included ? "1" : "0"} />
          </React.Fragment>
        );
      })}
    </>
  );
}

/** The custom levels' hidden inputs — five parallel arrays. */
export function CustomLevelInputs({ setup }: { setup: SetupState }) {
  return (
    <>
      {setup.cursus.customLevels.map((row) => (
        <React.Fragment key={row.key}>
          <input type="hidden" name="customLevelCycle" value={row.cycle} />
          <input type="hidden" name="customLevelCode" value={row.code} />
          <input type="hidden" name="customLevelName" value={row.name} />
          <input type="hidden" name="customLevelNameAr" value={row.nameAr} />
          <input type="hidden" name="customLevelGradeYear" value={row.gradeYear} />
        </React.Fragment>
      ))}
    </>
  );
}
