"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  GraduationCapIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { useI18n } from "@/components/providers/i18n-provider";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { EmptyState } from "@/components/shell/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { StudentRow } from "@/modules/students/queries";

/**
 * The students list.
 *
 * Placement — level and class — is shown alongside identity because "who is not
 * yet in a class" is the question this screen is opened to answer far more often
 * than "what is this child's date of birth".
 */
export function StudentsManager({
  students,
  permissions,
}: {
  students: StudentRow[];
  permissions: { canCreate: boolean; canUpdate: boolean; canDelete: boolean };
}) {
  const { t, locale } = useI18n();
  const [deleting, setDeleting] = React.useState<StudentRow | null>(null);

  const columns = React.useMemo<ColumnDef<StudentRow, unknown>[]>(
    () => [
      {
        id: "student",
        accessorFn: (row) =>
          `${row.firstName} ${row.lastName} ${row.firstNameAr ?? ""} ${
            row.lastNameAr ?? ""
          } ${row.code} ${row.massarCode ?? ""}`,
        header: t.student.studentColumn,
        cell: ({ row }) => {
          const student = row.original;
          const initials = `${student.firstName[0] ?? ""}${
            student.lastName[0] ?? ""
          }`
            .toUpperCase()
            .trim();

          return (
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-9 shrink-0">
                {student.photoUrl ? (
                  <AvatarImage src={student.photoUrl} alt="" />
                ) : null}
                <AvatarFallback className="text-xs">
                  {initials || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <Link
                  href={`/students/${student.id}`}
                  className="truncate font-medium hover:underline"
                >
                  {student.firstName} {student.lastName}
                </Link>
                <p className="text-muted-foreground truncate text-xs" dir="ltr">
                  {student.code}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        id: "placement",
        accessorFn: (row) => `${row.levelName ?? ""} ${row.className ?? ""}`,
        header: t.student.placement,
        cell: ({ row }) => {
          const student = row.original;
          if (!student.levelName) {
            return (
              <span className="text-muted-foreground text-sm">
                {t.student.notEnrolled}
              </span>
            );
          }
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary">{student.levelName}</Badge>
              {student.className ? (
                <Badge variant="outline">{student.className}</Badge>
              ) : (
                <span className="text-muted-foreground text-xs">
                  {t.student.notPlaced}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "age",
        accessorFn: (row) => ageFrom(row.birthDate) ?? -1,
        header: t.student.age,
        meta: { className: "hidden @3xl/table:table-cell" },
        cell: ({ row }) => {
          const age = ageFrom(row.original.birthDate);
          return age === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className="tabular-nums">{formatNumber(age, locale)}</span>
          );
        },
      },
      {
        accessorKey: "gender",
        header: t.student.gender,
        meta: { className: "hidden @4xl/table:table-cell" },
        cell: ({ row }) => (
          <span className="text-sm">
            {
              t.studentOptions.genders[
                row.original.gender as keyof typeof t.studentOptions.genders
              ]
            }
          </span>
        ),
      },
      {
        accessorKey: "familyName",
        header: t.student.family,
        meta: { className: "hidden @5xl/table:table-cell" },
        cell: ({ row }) =>
          row.original.familyId ? (
            <Link
              href={`/families/${row.original.familyId}`}
              className="text-sm hover:underline"
            >
              {row.original.familyName}
            </Link>
          ) : (
            <span className="text-muted-foreground text-sm">
              {t.family.noContact}
            </span>
          ),
      },
      {
        accessorKey: "status",
        header: t.school.status,
        cell: ({ row }) => <StudentStatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          if (!permissions.canUpdate && !permissions.canDelete) return null;

          return (
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
                      <Link href={`/students/${row.original.id}`}>
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
                        onSelect={() => setDeleting(row.original)}
                      >
                        <Trash2Icon />
                        {t.common.delete}
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [t, locale, permissions.canUpdate, permissions.canDelete],
  );

  const newButton = permissions.canCreate ? (
    <Button asChild>
      <Link href="/students/new">
        <PlusIcon />
        {t.student.newStudent}
      </Link>
    </Button>
  ) : undefined;

  return (
    <>
      <DataTable
        columns={columns}
        data={students}
        searchPlaceholder={t.student.searchPlaceholder}
        pageSize={15}
        emptyState={
          <EmptyState
            icon={<GraduationCapIcon className="size-5" />}
            title={t.student.noStudents}
            description={t.student.subtitle}
            action={newButton}
          />
        }
        toolbar={newButton}
      />

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
