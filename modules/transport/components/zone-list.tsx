"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MapPinnedIcon, PencilIcon, PlusIcon } from "lucide-react";
import * as React from "react";

import { DataTable } from "@/components/data-table/data-table";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { useSettings } from "@/components/providers/settings-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { IDLE } from "@/lib/action-state";
import { formatAmount } from "@/lib/i18n/format";
import { saveZoneAction } from "@/modules/transport/actions";
import { centimesToDirhams } from "@/modules/treasury/enums";
import { Field } from "@/modules/transport/components/field";
import type { ZoneRow } from "@/modules/transport/queries";

/** What a stop costs: the zones and the rate each one carries. */
export function ZoneList({
  zones,
  canManage,
}: {
  zones: ZoneRow[];
  canManage: boolean;
}) {
  const t = useT();
  const { currencyCode: currency } = useSettings();
  const locale = useLocale();
  const [editing, setEditing] = React.useState<ZoneRow | null>(null);
  const [creating, setCreating] = React.useState(false);

  const columns = React.useMemo<ColumnDef<ZoneRow, unknown>[]>(() => {
    const list: ColumnDef<ZoneRow, unknown>[] = [
      {
        id: "zone",
        accessorFn: (row) => `${row.name} ${row.code}`,
        header: t.transport.zone,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.name}</p>
            <p className="text-muted-foreground truncate text-xs">
              {row.original.code}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "amountCentimes",
        header: t.transport.zonePrice,
        meta: { className: "text-end" },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatAmount(row.original.amountCentimes, locale)} {currency}
          </span>
        ),
      },
      {
        accessorKey: "stopCount",
        header: t.transport.stops,
        meta: { className: "text-end" },
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.stopCount}</span>
        ),
      },
      {
        accessorKey: "riderCount",
        header: t.transport.riders,
        meta: { className: "text-end" },
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.riderCount}</span>
        ),
      },
    ];

    if (canManage) {
      list.push({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t.common.edit}
              onClick={() => setEditing(row.original)}
            >
              <PencilIcon />
            </Button>
          </div>
        ),
      });
    }

    return list;
  }, [t, locale, currency, canManage]);

  const newButton = canManage ? (
    <Button onClick={() => setCreating(true)}>
      <PlusIcon />
      {t.transport.newZone}
    </Button>
  ) : undefined;

  return (
    <div className="grid gap-3">
      <p className="text-muted-foreground text-sm">{t.transport.zonesHint}</p>

      <DataTable
        columns={columns}
        data={zones}
        pageSize={15}
        emptyState={
          <EmptyState
            icon={<MapPinnedIcon className="size-5" />}
            title={t.transport.noZones}
            action={newButton}
          />
        }
        toolbar={newButton}
      />

      {creating || editing ? (
        <ZoneDialog
          zone={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function ZoneDialog({
  zone,
  onClose,
}: {
  zone: ZoneRow | null;
  onClose: () => void;
}) {
  const t = useT();
  const [state, formAction] = React.useActionState(saveZoneAction, IDLE);
  useActionFeedback(state, { onSuccess: onClose });
  const errors = state.fieldErrors ?? {};

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>
              {zone ? t.transport.editZone : t.transport.newZone}
            </DialogTitle>
            <DialogDescription>{t.transport.zonesHint}</DialogDescription>
          </DialogHeader>

          {zone ? <input type="hidden" name="id" value={zone.id} /> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t.transport.routeCode}
              name="code"
              error={errors.code}
              required
            >
              <Input
                id="code"
                name="code"
                defaultValue={zone?.code ?? ""}
                required
              />
            </Field>
            <Field
              label={t.transport.routeName}
              name="name"
              error={errors.name}
              required
            >
              <Input
                id="name"
                name="name"
                defaultValue={zone?.name ?? ""}
                required
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t.transport.zonePrice}
              name="amount"
              error={errors.amount}
              required
            >
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                dir="ltr"
                defaultValue={
                  zone ? centimesToDirhams(zone.amountCentimes).toFixed(2) : ""
                }
                required
              />
            </Field>
            <Field label={t.transport.position} name="position">
              <Input
                id="position"
                name="position"
                type="number"
                min="0"
                dir="ltr"
                defaultValue={zone?.position ?? 0}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="isActive">{t.common.active}</Label>
            <Switch
              id="isActive"
              name="isActive"
              defaultChecked={zone?.isActive ?? true}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <SubmitButton>{t.common.save}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
