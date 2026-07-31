"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  HomeIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import type { FacetDef } from "@/components/data-table/data-table-facet";
import { useI18n } from "@/components/providers/i18n-provider";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { EmptyState } from "@/components/shell/empty-state";
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
import { deleteFamilyAction } from "@/modules/families/actions";
import { FAMILY_SITUATIONS } from "@/modules/families/enums";
import type { FamilyRow } from "@/modules/families/queries";

/** The families list: one row per dossier, with who to call and how many children. */
export function FamiliesManager({
  families,
  permissions,
}: {
  families: FamilyRow[];
  permissions: { canCreate: boolean; canUpdate: boolean; canDelete: boolean };
}) {
  const { t, locale } = useI18n();
  const [deleting, setDeleting] = React.useState<FamilyRow | null>(null);

  const columns = React.useMemo<ColumnDef<FamilyRow, unknown>[]>(
    () => [
      {
        id: "family",
        // Everything a secretary would type into the search box.
        accessorFn: (row) =>
          `${row.name} ${row.nameAr ?? ""} ${row.code} ${row.phone ?? ""} ${
            row.primaryContactName ?? ""
          } ${row.primaryContactPhone ?? ""}`,
        header: t.family.familyColumn,
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              href={`/families/${row.original.id}`}
              className="truncate font-medium hover:underline"
            >
              {row.original.name}
            </Link>
            <p className="text-muted-foreground truncate text-xs" dir="ltr">
              {row.original.code}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "situation",
        header: t.family.situation,
        meta: { className: "hidden @3xl/table:table-cell" },
        cell: ({ row }) => (
          <Badge variant="secondary">
            {
              t.familyOptions.situations[
                row.original.situation as keyof typeof t.familyOptions.situations
              ]
            }
          </Badge>
        ),
      },
      {
        id: "contact",
        accessorFn: (row) => row.primaryContactName ?? "",
        header: t.family.primaryContact,
        cell: ({ row }) => {
          const family = row.original;
          if (!family.primaryContactName) {
            return (
              <span className="text-muted-foreground">{t.family.noContact}</span>
            );
          }
          return (
            <div className="min-w-0">
              <p className="truncate text-sm">{family.primaryContactName}</p>
              {family.primaryContactPhone ? (
                <p
                  className="text-muted-foreground flex items-center gap-1 truncate text-xs"
                  dir="ltr"
                >
                  <PhoneIcon className="size-3 shrink-0" />
                  {family.primaryContactPhone}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "city",
        header: t.family.city,
        meta: { className: "hidden @4xl/table:table-cell" },
        cell: ({ row }) =>
          row.original.city ?? <span className="text-muted-foreground">—</span>,
      },
      {
        accessorKey: "childCount",
        header: t.family.children,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatNumber(row.original.childCount, locale)}
          </span>
        ),
      },
      {
        accessorKey: "isActive",
        header: t.school.status,
        meta: { className: "hidden @5xl/table:table-cell" },
        cell: ({ row }) =>
          row.original.isActive ? (
            <Badge variant="secondary">{t.common.active}</Badge>
          ) : (
            <Badge variant="outline">{t.common.inactive}</Badge>
          ),
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
                      <Link href={`/families/${row.original.id}`}>
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

  const facets = React.useMemo<FacetDef[]>(() => {
    const cities = [
      ...new Set(families.map((family) => family.city).filter(Boolean)),
    ].sort() as string[];

    return [
      {
        columnId: "situation",
        label: t.family.situation,
        options: FAMILY_SITUATIONS.map((situation) => ({
          value: situation,
          label: t.familyOptions.situations[situation],
        })),
      },
      {
        columnId: "isActive",
        label: t.school.status,
        options: [
          { value: "true", label: t.common.active },
          { value: "false", label: t.common.inactive },
        ],
      },
      // Only offered once there is something to choose between — a single-value
      // facet is a button that cannot change what the reader is looking at.
      ...(cities.length > 1
        ? [
            {
              columnId: "city",
              label: t.family.city,
              options: cities.map((city) => ({ value: city, label: city })),
            },
          ]
        : []),
    ];
  }, [families, t]);

  const newButton = permissions.canCreate ? (
    <Button asChild>
      <Link href="/families/new">
        <PlusIcon />
        {t.family.newFamily}
      </Link>
    </Button>
  ) : undefined;

  return (
    <>
      <DataTable
        columns={columns}
        data={families}
        facets={facets}
        searchPlaceholder={t.family.searchPlaceholder}
        emptyState={
          <EmptyState
            icon={<HomeIcon className="size-5" />}
            title={t.family.noFamilies}
            description={t.family.subtitle}
            action={newButton}
          />
        }
        toolbar={newButton}
      />

      {deleting ? (
        <ConfirmDelete
          open={Boolean(deleting)}
          onOpenChange={(open) => !open && setDeleting(null)}
          title={t.family.deleteTitle}
          description={interpolate(t.family.deleteBody, { name: deleting.name })}
          action={() => deleteFamilyAction(deleting.id)}
          onDeleted={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}
