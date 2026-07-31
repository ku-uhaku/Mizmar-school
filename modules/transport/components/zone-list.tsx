"use client";

import { PlusIcon } from "lucide-react";
import * as React from "react";

import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IDLE } from "@/lib/action-state";
import { formatAmount } from "@/lib/i18n/format";
import { saveZoneAction } from "@/modules/transport/actions";
import { centimesToDirhams } from "@/modules/treasury/enums";
import { Field } from "@/modules/transport/components/field";
import type { ZoneRow } from "@/modules/transport/queries";

/** What a stop costs: the zones and the rate each one carries. */
export function ZoneList({ zones, canManage }: { zones: ZoneRow[]; canManage: boolean }) {
  const t = useT();
  const locale = useLocale();
  const [editing, setEditing] = React.useState<ZoneRow | null>(null);
  const [creating, setCreating] = React.useState(false);

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">{t.transport.zonesHint}</p>
        {canManage ? (
          <Button size="sm" onClick={() => setCreating(true)}>
            <PlusIcon className="size-4" />
            {t.transport.newZone}
          </Button>
        ) : null}
      </div>

      {zones.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            {t.transport.noZones}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.transport.zone}</TableHead>
                  <TableHead className="text-end">{t.transport.zonePrice}</TableHead>
                  <TableHead className="text-end">{t.transport.stops}</TableHead>
                  <TableHead className="text-end">{t.transport.riders}</TableHead>
                  {canManage ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map((zone) => (
                  <TableRow key={zone.id}>
                    <TableCell>
                      <span className="font-medium">{zone.name}</span>
                      <span className="text-muted-foreground block text-xs">
                        {zone.code}
                      </span>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatAmount(zone.amountCentimes, locale)} MAD
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {zone.stopCount}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {zone.riderCount}
                    </TableCell>
                    {canManage ? (
                      <TableCell className="text-end">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(zone)}>
                          {t.common.edit}
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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

function ZoneDialog({ zone, onClose }: { zone: ZoneRow | null; onClose: () => void }) {
  const t = useT();
  const [state, formAction] = React.useActionState(saveZoneAction, IDLE);
  useActionFeedback(state, { onSuccess: onClose });
  const errors = state.fieldErrors ?? {};

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{zone ? t.transport.editZone : t.transport.newZone}</DialogTitle>
            <DialogDescription>{t.transport.zonesHint}</DialogDescription>
          </DialogHeader>

          {zone ? <input type="hidden" name="id" value={zone.id} /> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.transport.routeCode} name="code" error={errors.code} required>
              <Input id="code" name="code" defaultValue={zone?.code ?? ""} required />
            </Field>
            <Field label={t.transport.routeName} name="name" error={errors.name} required>
              <Input id="name" name="name" defaultValue={zone?.name ?? ""} required />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.transport.zonePrice} name="amount" error={errors.amount} required>
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
            <Switch id="isActive" name="isActive" defaultChecked={zone?.isActive ?? true} />
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
