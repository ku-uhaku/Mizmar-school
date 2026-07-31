"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  PowerOffIcon,
  Trash2Icon,
  WalletIcon,
} from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table/data-table";
import type { FacetDef } from "@/components/data-table/data-table-facet";
import { FormField, controlProps } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSettings } from "@/components/providers/settings-provider";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import { formatAmount, formatDate, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import {
  deleteCashRegisterAction,
  saveCashRegisterAction,
  setCashRegisterActiveAction,
} from "@/modules/treasury/actions";
import type { RegisterRow } from "@/modules/treasury/queries";

/**
 * The tills, and how a school adds one.
 *
 * ── Why retiring and deleting are different buttons ─────────────────────────
 * A till that has held a shift is pointed at by every session and every
 * operation posted through it. Deleting it would cascade that away and take the
 * ledger's audit trail with it, so it is refused — the row is retired instead,
 * which takes it out of the pickers and leaves the history intact. Only a till
 * that has never been opened can actually be removed, and that is exactly the
 * one somebody created by mistake.
 */
export function RegistersManager({
  registers,
  canManage,
}: {
  registers: RegisterRow[];
  canManage: boolean;
}) {
  const { t, locale } = useI18n();
  const { currencyCode: currency } = useSettings();
  const [editing, setEditing] = React.useState<RegisterRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<RegisterRow | null>(null);
  const [, startTransition] = React.useTransition();

  function toggleActive(register: RegisterRow) {
    const data = new FormData();
    data.set("id", register.id);
    // The checkbox convention the action reads — see `boolField`.
    if (!register.isActive) data.set("isActive", "on");

    startTransition(async () => {
      const result = await setCashRegisterActiveAction(IDLE, data);
      if (result.status === "success") toast.success(result.message ?? "");
      else toast.error(result.message ?? t.errors.unexpected);
    });
  }

  const columns = React.useMemo<ColumnDef<RegisterRow, unknown>[]>(
    () => [
      {
        id: "register",
        accessorFn: (row) => `${row.name} ${row.code} ${row.nameAr ?? ""}`,
        header: t.treasury.register,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                row.original.openSession
                  ? "bg-success/10 text-success"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <WalletIcon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {row.original.name}
              </p>
              <p className="text-muted-foreground truncate text-xs" dir="ltr">
                {row.original.code}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "state",
        // The open session is the thing a bursar scans this list for, so it is
        // a column of its own rather than a detail inside the name.
        accessorFn: (row) => (row.openSession ? "OPEN" : "CLOSED"),
        header: t.treasury.session,
        cell: ({ row }) => {
          const session = row.original.openSession;
          if (!session) {
            return (
              <span className="text-muted-foreground text-sm">
                {t.treasury.statusClosed}
              </span>
            );
          }
          return (
            <div className="min-w-0">
              <Badge className="bg-success text-background hover:bg-success">
                {t.treasury.statusOpen}
              </Badge>
              <p className="text-muted-foreground mt-1 truncate text-xs">
                {session.openedByName} · {formatDate(session.openedAt, locale)}
              </p>
            </div>
          );
        },
      },
      {
        id: "drawer",
        accessorFn: (row) => row.openSession?.expectedCentimes ?? -1,
        header: t.treasury.inDrawer,
        meta: { className: "hidden @3xl/table:table-cell" },
        cell: ({ row }) => {
          const session = row.original.openSession;
          return session ? (
            <span className="tabular-nums">
              {formatAmount(session.expectedCentimes, locale)} {currency}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        accessorKey: "sessionCount",
        header: t.treasury.shifts,
        meta: { className: "hidden @4xl/table:table-cell" },
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.sessionCount}</span>
        ),
      },
      {
        accessorKey: "isActive",
        header: t.school.status,
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
          if (!canManage) return null;
          const register = row.original;
          // Only a till nobody has ever opened can be removed — see above.
          const removable = register.sessionCount === 0;

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
                  <DropdownMenuItem onSelect={() => setEditing(register)}>
                    <PencilIcon />
                    {t.common.edit}
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onSelect={() => toggleActive(register)}
                    // Retiring an open till would hide a drawer somebody still
                    // has to count.
                    disabled={
                      register.isActive && register.openSession !== null
                    }
                  >
                    {register.isActive ? <PowerOffIcon /> : <PowerIcon />}
                    {register.isActive ? t.treasury.retire : t.treasury.restore}
                  </DropdownMenuItem>

                  {removable ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeleting(register)}
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
    // `toggleActive` is stable enough for this list; the linter cannot see that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, locale, canManage],
  );

  const facets = React.useMemo<FacetDef[]>(
    () => [
      {
        columnId: "state",
        label: t.treasury.session,
        options: [
          { value: "OPEN", label: t.treasury.statusOpen },
          { value: "CLOSED", label: t.treasury.statusClosed },
        ],
      },
      {
        columnId: "isActive",
        label: t.school.status,
        options: [
          { value: "true", label: t.common.active },
          { value: "false", label: t.common.inactive },
        ],
      },
    ],
    [t],
  );

  const newButton = canManage ? (
    <Button onClick={() => setCreating(true)}>
      <PlusIcon />
      {t.treasury.newRegister}
    </Button>
  ) : undefined;

  return (
    <>
      <DataTable
        columns={columns}
        data={registers}
        searchPlaceholder={t.treasury.register}
        facets={facets}
        pageSize={15}
        emptyState={
          <EmptyState
            icon={<WalletIcon className="size-5" />}
            title={t.treasury.noRegisters}
            description={t.treasury.noRegistersHint}
            action={newButton}
          />
        }
        toolbar={newButton}
      />

      {creating || editing ? (
        <RegisterDialog
          register={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDelete
          open={Boolean(deleting)}
          onOpenChange={(open) => !open && setDeleting(null)}
          title={t.treasury.deleteRegisterTitle}
          description={interpolate(t.treasury.deleteRegisterBody, {
            name: deleting.name,
          })}
          action={() => deleteCashRegisterAction(deleting.id)}
          onDeleted={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}

function RegisterDialog({
  register,
  onClose,
}: {
  register: RegisterRow | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [state, formAction] = React.useActionState(
    saveCashRegisterAction,
    IDLE,
  );
  useActionFeedback(state, { onSuccess: onClose });

  const errors = state.fieldErrors ?? {};

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>
              {register ? t.treasury.editRegister : t.treasury.newRegister}
            </DialogTitle>
            <DialogDescription>{t.treasury.registersHint}</DialogDescription>
          </DialogHeader>

          {register ? (
            <input type="hidden" name="id" value={register.id} />
          ) : null}

          <div className="grid gap-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                name="code"
                label={t.treasury.registerCode}
                required
                error={errors.code}
              >
                <Input
                  {...controlProps("code", errors.code)}
                  defaultValue={register?.code ?? ""}
                  maxLength={32}
                  dir="ltr"
                  placeholder="PRINCIPALE"
                />
              </FormField>

              <FormField
                name="position"
                label={t.treasury.registerPosition}
                error={errors.position}
              >
                <Input
                  {...controlProps("position", errors.position)}
                  type="number"
                  min={0}
                  max={99}
                  defaultValue={register?.position ?? 0}
                  dir="ltr"
                />
              </FormField>
            </div>

            <FormField
              name="name"
              label={t.treasury.registerName}
              required
              error={errors.name}
            >
              <Input
                {...controlProps("name", errors.name)}
                defaultValue={register?.name ?? ""}
                maxLength={120}
              />
            </FormField>

            <FormField
              name="nameAr"
              label={t.configuration.fields.nameAr}
              error={errors.nameAr}
            >
              <Input
                {...controlProps("nameAr", errors.nameAr)}
                defaultValue={register?.nameAr ?? ""}
                maxLength={120}
                dir="rtl"
              />
            </FormField>

            <FormField
              name="notes"
              label={t.treasury.registerNotes}
              error={errors.notes}
            >
              <Textarea
                {...controlProps("notes", errors.notes)}
                defaultValue={register?.notes ?? ""}
                rows={2}
              />
            </FormField>
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
