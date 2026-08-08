"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  FileSpreadsheetIcon,
  GraduationCapIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

import { TablePagination } from "@/components/data-table/table-pagination";
import { useI18n } from "@/components/providers/i18n-provider";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { EmptyState } from "@/components/shell/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatNumber, interpolate } from "@/lib/i18n/format";
import { ageFrom } from "@/lib/utils";
import { deleteStudentAction } from "@/modules/students/actions";
import { StudentStatusBadge } from "@/modules/students/components/student-status-badge";
import { StudentsFilters } from "@/modules/students/components/students-filters";
import type {
  StudentFacetOptions,
  StudentRow,
  StudentsPage,
} from "@/modules/students/queries";

/**
 * The pupils list.
 *
 * Placement — level and class — is shown alongside identity because "who is not
 * yet in a class" is the question this screen is opened to answer far more often
 * than "what is this child's date of birth".
 *
 * ── Why this is not the app's `DataTable` ────────────────────────────────────
 * That component filters, sorts and pages in the browser, which is the right
 * trade for one organisation's schools or roles — a few hundred rows, and
 * instant search worth the payload. A school's roll has no ceiling: it grows
 * every rentrée, and shipping a row per pupil with their placement before
 * anybody has typed anything is a page that gets slower every year and never
 * gets faster. It is the second such table after the caisse ledger, and it is
 * built the same way — the window, the search, the facets and the order are all
 * decided on the server and read from the URL, so a filter narrows the whole
 * roll rather than the twenty rows in front of the reader.
 */
export function StudentsManager({
  page,
  facetOptions,
  permissions,
}: {
  page: StudentsPage;
  /** What the level and class facets may offer — see `listStudentFacetOptions`. */
  facetOptions: StudentFacetOptions;
  permissions: { canCreate: boolean; canUpdate: boolean; canDelete: boolean };
}) {
  const { t, locale } = useI18n();
  const [deleting, setDeleting] = React.useState<StudentRow | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const newButton = permissions.canCreate ? (
    <Button asChild>
      <Link href="/students/new">
        <PlusIcon />
        {t.student.newStudent}
      </Link>
    </Button>
  ) : undefined;

  /*
    Import and export sit next to "new pupil" rather than under a settings menu.
    The moment a school reaches for them is the moment it is looking at an empty
    or half-entered list, which is this screen — and the empty state below offers
    the same link, because "add them one by one" is the wrong first answer for
    somebody holding a spreadsheet of four hundred.
  */
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline">
        <Link href="/students/import">
          <FileSpreadsheetIcon />
          {t.student.importExport}
        </Link>
      </Button>
      {newButton}
    </div>
  );

  // An empty roll and a filter that matched nothing are different stories, and
  // the difference is only knowable from the URL now that the narrowing happens
  // on the server.
  const isFiltered = ["q", "status", "level", "class", "gender"].some((key) =>
    searchParams.get(key),
  );

  if (page.total === 0 && !isFiltered) {
    return (
      <Card className="overflow-hidden py-0">
        <EmptyState
          icon={<GraduationCapIcon className="size-5" />}
          title={t.student.noStudents}
          description={t.student.subtitle}
          action={toolbar}
        />
      </Card>
    );
  }

  return (
    <>
      <div className="@container/table bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
          <span className="text-muted-foreground text-sm tabular-nums">
            {interpolate(t.student.studentCount, { count: page.total })}
          </span>
          {toolbar}
        </div>

        <StudentsFilters facetOptions={facetOptions} />

        {page.rows.length === 0 ? (
          <EmptyState
            icon={<GraduationCapIcon className="size-5" />}
            title={t.student.noStudentMatches}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.student.studentColumn}</TableHead>
                    <TableHead>{t.enrolment.level}</TableHead>
                    <TableHead>{t.schoolClass.title}</TableHead>
                    <TableHead className="hidden @3xl/table:table-cell">
                      {t.student.age}
                    </TableHead>
                    <TableHead className="hidden @4xl/table:table-cell">
                      {t.student.gender}
                    </TableHead>
                    <TableHead className="hidden @5xl/table:table-cell">
                      {t.student.family}
                    </TableHead>
                    <TableHead>{t.school.status}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {page.rows.map((student) => {
                    const initials = `${student.firstName[0] ?? ""}${
                      student.lastName[0] ?? ""
                    }`
                      .toUpperCase()
                      .trim();
                    const age = ageFrom(student.birthDate);

                    return (
                      <TableRow key={student.id}>
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar className="size-9 shrink-0">
                              {student.photoUrl ? (
                                <AvatarImage src={student.photoUrl} alt="" />
                              ) : null}
                              <AvatarFallback className="text-xs">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <Link
                                href={`/students/${student.id}`}
                                className="truncate font-medium hover:underline"
                              >
                                {student.firstName} {student.lastName}
                              </Link>
                              <p
                                className="text-muted-foreground truncate text-xs"
                                dir="ltr"
                              >
                                {student.code}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        {/*
                          Level and class stay separate columns rather than one
                          "placement" cell so each can carry its own facet —
                          "show me 3AP" and "show me who is not in a class" are
                          the two questions this screen is opened for, and
                          neither is answerable by typing into a search box.
                        */}
                        <TableCell>
                          {student.levelName ? (
                            <Badge variant="secondary">{student.levelName}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              {t.student.notEnrolled}
                            </span>
                          )}
                        </TableCell>

                        <TableCell>
                          {student.className ? (
                            <Badge variant="outline">{student.className}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              {t.student.notPlaced}
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="hidden @3xl/table:table-cell">
                          {age === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className="tabular-nums">
                              {formatNumber(age, locale)}
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="hidden text-sm @4xl/table:table-cell">
                          {
                            t.studentOptions.genders[
                              student.gender as keyof typeof t.studentOptions.genders
                            ]
                          }
                        </TableCell>

                        <TableCell className="hidden @5xl/table:table-cell">
                          {student.familyId ? (
                            <Link
                              href={`/families/${student.familyId}`}
                              className="text-sm hover:underline"
                            >
                              {student.familyName}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              {t.family.noContact}
                            </span>
                          )}
                        </TableCell>

                        <TableCell>
                          <StudentStatusBadge status={student.status} />
                        </TableCell>

                        <TableCell>
                          {permissions.canUpdate || permissions.canDelete ? (
                            <div className="flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={t.common.openMenu}
                                  >
                                    <MoreHorizontalIcon />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {permissions.canUpdate ? (
                                    <DropdownMenuItem asChild>
                                      <Link href={`/students/${student.id}`}>
                                        <PencilIcon />
                                        {t.common.edit}
                                      </Link>
                                    </DropdownMenuItem>
                                  ) : null}
                                  {permissions.canDelete ? (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        variant="destructive"
                                        onSelect={() => setDeleting(student)}
                                      >
                                        <Trash2Icon />
                                        {t.common.delete}
                                      </DropdownMenuItem>
                                    </>
                                  ) : null}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {page.pageCount > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
                <p className="text-muted-foreground text-sm tabular-nums">
                  {page.page} {t.common.of} {page.pageCount}
                </p>
                <TablePagination
                  page={page.page}
                  pageCount={page.pageCount}
                  hrefFor={(target) => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("page", String(target));
                    return `${pathname}?${params.toString()}`;
                  }}
                />
              </div>
            ) : null}
          </>
        )}
      </div>

      {deleting ? (
        <ConfirmDelete
          open={Boolean(deleting)}
          onOpenChange={(open) => !open && setDeleting(null)}
          title={t.student.deleteTitle}
          description={interpolate(t.student.deleteBody, {
            name: `${deleting.firstName} ${deleting.lastName}`,
          })}
          action={() => deleteStudentAction(deleting.id)}
          onDeleted={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}
