"use client";

import * as React from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { toast } from "sonner";

import { useT } from "@/components/providers/i18n-provider";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  openPortalAccountAction,
  resetPortalPasswordAction,
} from "@/modules/families/actions";
import type { GuardianRow } from "@/modules/families/queries";
import type { IssuedPortalCredentials } from "@/modules/families/service";

/**
 * The office types the password it is about to hand over.
 *
 * A generated password is right when nobody is waiting at the counter and wrong
 * when somebody is: a parent who cannot read `kQ7mfRt2xLpA` off a slip rings the
 * school, and the secretary ends up choosing one over the telephone anyway.
 * Leaving the field empty still generates one, so the safe default costs a
 * keystroke rather than being taken away.
 *
 * Both doors lead here — opening an access and changing an existing one — for
 * the same reason they share an action shape: what the school does afterwards
 * (read it out, print it) is identical, and a second dialog would be a second
 * place for the slip to go missing.
 *
 * Mounted only while it is open, so a typed password never outlives the dialog
 * that took it — closing it takes the string out of React's tree rather than
 * leaving it in state for the next time somebody opens the same dossier.
 */
export function PortalPasswordDialog({
  open,
  onOpenChange,
  mode,
  guardians,
  guardianId,
  onIssued,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `open` mints the account; `reset` replaces the password on the one held. */
  mode: "open" | "reset";
  /** Everyone on the dossier — the choice of who signs in, when opening. */
  guardians: GuardianRow[];
  /** Fixed for a reset; the default selection when opening. */
  guardianId: string | null;
  onIssued: (credentials: IssuedPortalCredentials) => void;
}) {
  const t = useT();
  const [pending, startTransition] = React.useTransition();
  const [password, setPassword] = React.useState("");
  const [visible, setVisible] = React.useState(false);

  // The dossier's own choice of who the school deals with, unless the caller
  // named somebody — the same adult the app would ring first.
  const [chosen, setChosen] = React.useState<string>(
    () =>
      guardianId ??
      (
        guardians.find((guardian) => guardian.isPrimaryContact) ??
        guardians.find((guardian) => guardian.isActive) ??
        guardians[0]
      )?.id ??
      "",
  );

  function submit() {
    if (!chosen) return;

    startTransition(async () => {
      const action =
        mode === "open" ? openPortalAccountAction : resetPortalPasswordAction;
      // Empty means "generate one" — decided on the server, where the random
      // source is.
      const result = await action(chosen, password.trim() || undefined);

      if (result.status === "success" && result.data) {
        toast.success(result.message ?? t.family.portalOpened);
        onOpenChange(false);
        onIssued(result.data);
      } else {
        toast.error(result.message ?? t.errors.unexpected);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.family.portalChooseTitle}</DialogTitle>
          <DialogDescription>
            {t.family.portalChooseBody}
            {mode === "reset" ? ` ${t.family.portalChooseReset}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {mode === "open" && guardians.length > 1 ? (
            <div className="grid gap-1.5">
              <Label htmlFor="portal-guardian">
                {t.family.portalWhichGuardian}
              </Label>
              <Select value={chosen} onValueChange={setChosen}>
                <SelectTrigger id="portal-guardian" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {guardians.map((guardian) => (
                    <SelectItem key={guardian.id} value={guardian.id}>
                      {guardian.firstName} {guardian.lastName} ·{" "}
                      {
                        t.familyOptions.relationships[
                          guardian.relationship as keyof typeof t.familyOptions.relationships
                        ]
                      }
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid gap-1.5">
            <Label htmlFor="portal-password">{t.family.portalPassword}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="portal-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                // Typed by a member of staff for somebody else: nothing here
                // should reach a password manager or be offered back later.
                type={visible ? "text" : "password"}
                autoComplete="off"
                dir="ltr"
                placeholder={t.family.portalPasswordPlaceholder}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submit();
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={
                  visible
                    ? t.family.portalHidePassword
                    : t.family.portalShowPassword
                }
                onClick={() => setVisible((shown) => !shown)}
              >
                {visible ? (
                  <EyeOffIcon className="size-4" />
                ) : (
                  <EyeIcon className="size-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t.common.cancel}
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={pending || !chosen}
          >
            {mode === "open"
              ? t.family.portalOpenAccess
              : t.family.portalChangePassword}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
