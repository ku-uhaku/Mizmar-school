"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SettingsIcon,
  Trash2Icon,
} from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
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
import { formatDate, formatNumber } from "@/lib/i18n/format";
import { deleteConfigItemAction } from "@/modules/configuration/actions";
import { ResourceDialog } from "@/modules/configuration/components/resource-dialog";
import type {
  Choice,
  FieldDef,
  ResourceDef,
  ResourceRow,
} from "@/modules/configuration/types";

/**
 * Table + modals for one configuration resource.
 *
 * Columns come from the same descriptors the dialog builds its form from, so a
 * field added to a resource shows up in both without touching either.
 */
export function ResourceManager({
  resource,
  rows,
  choices,
  canManage,
}: {
  resource: ResourceDef;
  rows: ResourceRow[];
  choices: Record<string, Choice[]>;
  canManage: boolean;
}) {
  const { t, locale } = useI18n();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ResourceRow | undefined>();
  const [deleting, setDeleting] = React.useState<ResourceRow | null>(null);

  const labels = t.configuration.fields as Record<string, string>;
  const resourceName = (t.configuration.resources as Record<string, string>)[
    resource.labelKey
  ];

  function openCreate() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  /** Reference cells show the target's label, never its cuid. */
  const labelFor = React.useCallback(
    (field: FieldDef, value: string) =>
      choices[field.name]?.find((choice) => choice.id === value)?.label ?? value,
    [choices],
  );

  const columns = React.useMemo<ColumnDef<ResourceRow, unknown>[]>(() => {
    const visible = resource.fields.filter((field) => field.inTable);

    const dataColumns: ColumnDef<ResourceRow, unknown>[] = visible.map(
      (field) => ({
        accessorKey: field.name,
        header: labels[field.labelKey] ?? field.labelKey,
        cell: ({ row }) => (
          <Cell
            field={field}
            value={row.original[field.name]}
            locale={locale}
            optionLabels={
              field.optionsKey
                ? ((t.configOptions as Record<string, Record<string, string>>)[
                    field.optionsKey
                  ] ?? {})
                : {}
            }
            labelFor={labelFor}
            emptyLabel={t.common.notSet}
            yesLabel={t.common.yes}
            noLabel={t.common.no}
          />
        ),
      }),
    );

    if (!canManage) return dataColumns;

    return [
      ...dataColumns,
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={t.common.openMenu}
                >
                  <MoreHorizontalIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    setEditing(row.original);
                    setDialogOpen(true);
                  }}
                >
                  <PencilIcon />
                  {t.common.edit}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setDeleting(row.original)}
                >
                  <Trash2Icon />
                  {t.common.delete}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, t, locale, canManage, labelFor]);

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        emptyState={
          <EmptyState
            icon={<SettingsIcon className="size-5" />}
            title={t.configuration.empty}
            description={resourceName}
            action={
              canManage ? (
                <Button onClick={openCreate} size="sm">
                  <PlusIcon />
                  {t.configuration.newItem}
                </Button>
              ) : undefined
            }
          />
        }
        toolbar={
          canManage ? (
            <Button onClick={openCreate} className="ms-auto">
              <PlusIcon />
              {t.configuration.newItem}
            </Button>
          ) : undefined
        }
      />

      {canManage ? (
        <ResourceDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          resource={resource}
          choices={choices}
          row={editing}
        />
      ) : null}

      {deleting ? (
        <ConfirmDelete
          open={Boolean(deleting)}
          onOpenChange={(open) => !open && setDeleting(null)}
          title={t.configuration.deleteTitle}
          description={t.configuration.deleteBody}
          action={() => deleteConfigItemAction(resource.id, deleting.id)}
          onDeleted={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}

function Cell({
  field,
  value,
  locale,
  optionLabels,
  labelFor,
  emptyLabel,
  yesLabel,
  noLabel,
}: {
  field: FieldDef;
  value: string | number | boolean | null;
  locale: Parameters<typeof formatDate>[1];
  optionLabels: Record<string, string>;
  labelFor: (field: FieldDef, value: string) => string;
  emptyLabel: string;
  yesLabel: string;
  noLabel: string;
}) {
  if (field.type === "boolean") {
    return (
      <Badge variant={value ? "default" : "outline"}>
        {value ? yesLabel : noLabel}
      </Badge>
    );
  }

  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">{emptyLabel}</span>;
  }

  switch (field.type) {
    case "select":
      return (
        <Badge variant="secondary">
          {optionLabels[String(value)] ?? String(value)}
        </Badge>
      );

    case "reference":
      return <span>{labelFor(field, String(value))}</span>;

    case "money":
      // Stored in centimes; shown as dirhams.
      return (
        <span dir="ltr" className="tabular-nums">
          {formatNumber(Number(value) / 100, locale)} MAD
        </span>
      );

    case "date":
      return <span>{formatDate(String(value), locale)}</span>;

    case "color":
      return (
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-4 rounded border"
            style={{ backgroundColor: String(value) }}
          />
          <span dir="ltr" className="text-muted-foreground text-xs">
            {String(value)}
          </span>
        </span>
      );

    case "number":
      return (
        <span dir="ltr" className="tabular-nums">
          {formatNumber(Number(value), locale)}
        </span>
      );

    case "time":
      return (
        <span dir="ltr" className="tabular-nums">
          {String(value)}
        </span>
      );

    default:
      return (
        <span className="font-medium" dir={field.dir}>
          {String(value)}
        </span>
      );
  }
}
