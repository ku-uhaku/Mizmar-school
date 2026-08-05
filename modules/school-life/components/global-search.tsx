"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCapIcon,
  HomeIcon,
  LayersIcon,
  SearchIcon,
} from "lucide-react";

import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  globalSearchAction,
  type SearchResults,
} from "@/modules/school-life/actions";

const EMPTY: SearchResults = { students: [], families: [], classes: [] };

/**
 * The header search: one box that finds a pupil, a dossier or a class and takes
 * you to it.
 *
 * Server-side rather than a client-side filter over a preloaded list, because
 * the list is thousands of rows and because what a user may find has to be
 * decided by their permissions — which only the server knows. The action is
 * scoped to the working context, so switching school genuinely changes what
 * this box can find.
 *
 * Results are not filtered client-side either: `shouldFilter` is off, since
 * cmdk's fuzzy match over labels would hide rows the server matched on a phone
 * number or a MASSAR code that is not shown.
 */
export function GlobalSearch() {
  const t = useT();
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [term, setTerm] = React.useState("");
  const [results, setResults] = React.useState<SearchResults>(EMPTY);
  /**
   * The term `results` actually answers.
   *
   * `useTransition`'s pending flag is false during the debounce window, so
   * between the keystroke and the query firing the box had a term worth
   * searching, no results, and nothing claiming to be busy — and rendered
   * "Nothing found." for a fifth of a second before showing the matches. This
   * is what tells the two apart: while it lags `term`, no answer has come back
   * yet for what the user has typed.
   */
  const [answered, setAnswered] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  // ⌘K / Ctrl-K, the shortcut every search box of this shape has.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  /**
   * Clearing happens here rather than in the effect below: a term that is too
   * short has no query to wait for, so emptying the list is part of handling
   * the keystroke, not something to synchronise afterwards.
   */
  function changeTerm(value: string) {
    setTerm(value);
    if (value.trim().length < 2) {
      setResults(EMPTY);
      setAnswered(value);
    }
  }

  // Debounced: a query per keystroke would be a query per keystroke.
  React.useEffect(() => {
    if (term.trim().length < 2) return;

    /*
      Guards against an out-of-order answer.

      Two requests can be in flight across the debounce boundary, and nothing
      makes the network return them in the order they were sent: a slow "mar"
      landing after a fast "mart" used to overwrite the newer results with the
      older ones, leaving the box showing matches for a term the user had
      already finished typing past.
    */
    let cancelled = false;

    const timer = setTimeout(() => {
      startTransition(async () => {
        const next = await globalSearchAction(term);
        if (cancelled) return;
        setResults(next);
        setAnswered(term);
      });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  function go(href: string) {
    setOpen(false);
    setTerm("");
    setResults(EMPTY);
    setAnswered("");
    router.push(href);
  }

  const total =
    results.students.length + results.families.length + results.classes.length;
  const searching = pending || answered !== term;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-muted-foreground w-9 justify-start px-0 sm:w-56 sm:px-3"
        aria-label={t.schoolLife.search}
      >
        <SearchIcon className="size-4 shrink-0" />
        <span className="hidden truncate sm:inline">
          {t.schoolLife.searchPlaceholder}
        </span>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={t.schoolLife.search}
        description={t.schoolLife.searchPlaceholder}
      >
        {/* The server already decided what matches; see the note above. */}
        <Command shouldFilter={false}>
          <CommandInput
            value={term}
            onValueChange={changeTerm}
            placeholder={t.schoolLife.searchPlaceholder}
          />
          <CommandList>
            {total === 0 ? (
              <CommandEmpty>
                {term.trim().length < 2
                  ? t.schoolLife.searchHint
                  : searching
                    ? t.common.loading
                    : t.schoolLife.searchEmpty}
              </CommandEmpty>
            ) : null}

            {results.students.length > 0 ? (
              <CommandGroup heading={t.schoolLife.searchStudents}>
                {results.students.map((student) => (
                  <CommandItem
                    key={student.id}
                    value={`student-${student.id}`}
                    onSelect={() => go(`/students/${student.id}`)}
                  >
                    <GraduationCapIcon />
                    <span className="min-w-0 flex-1 truncate">
                      {student.label}
                    </span>
                    <span className="text-muted-foreground truncate text-xs">
                      {student.detail}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {results.families.length > 0 ? (
              <CommandGroup heading={t.schoolLife.searchFamilies}>
                {results.families.map((family) => (
                  <CommandItem
                    key={family.id}
                    value={`family-${family.id}`}
                    onSelect={() => go(`/families/${family.id}`)}
                  >
                    <HomeIcon />
                    <span className="min-w-0 flex-1 truncate">
                      {family.label}
                    </span>
                    <span className="text-muted-foreground truncate text-xs">
                      {family.detail}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {results.classes.length > 0 ? (
              <CommandGroup heading={t.schoolLife.searchClasses}>
                {results.classes.map((schoolClass) => (
                  <CommandItem
                    key={schoolClass.id}
                    value={`class-${schoolClass.id}`}
                    onSelect={() => go(`/classes/${schoolClass.id}`)}
                  >
                    <LayersIcon />
                    <span className="min-w-0 flex-1 truncate">
                      {schoolClass.label}
                    </span>
                    <span className="text-muted-foreground truncate text-xs">
                      {schoolClass.detail}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
