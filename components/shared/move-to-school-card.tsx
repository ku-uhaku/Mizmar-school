"use client";

import * as React from "react";
import { Loader2Icon, SchoolIcon } from "lucide-react";
import { toast } from "sonner";

import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionState } from "@/lib/action-state";

/**
 * "This was filed against the wrong school" — pick the right one and move it.
 *
 * Domain-free on purpose: it knows a record has a school and nothing else about
 * what the record is. The caller passes its own wording and its own bound
 * action, exactly as `ConfirmDelete` takes one, which is what lets the same card
 * sit on an employee file and on a dossier familial without either module
 * learning about the other.
 *
 * A card and not a menu item. Moving a record between schools is rare, it is
 * hard to undo by hand, and what it refuses to carry is the important part — so
 * it gets a heading, a sentence saying what follows the record and what does
 * not, and a deliberate second click. Buried in a "…" menu it would be found by
 * the wrong people and missed by the right ones.
 *
 * `schools` is the list the *caller* has already filtered to the schools the
 * reader may write in. The server re-derives that itself — see the note on
 * either transfer action — so an empty list hides the card rather than gating
 * anything.
 */
export function MoveToSchoolCard({
  title,
  description,
  label,
  confirmLabel,
  schools,
  action,
}: {
  title: string;
  description: string;
  /** The picker's own label — "New school". */
  label: string;
  /** The button — "Move this dossier". */
  confirmLabel: string;
  schools: { id: string; name: string }[];
  action: (schoolId: string) => Promise<ActionState>;
}) {
  const t = useT();
  const [schoolId, setSchoolId] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  if (schools.length === 0) return null;

  function move() {
    if (!schoolId) return;
    startTransition(async () => {
      const result = await action(schoolId);
      if (result.status === "success") {
        // The message carries the new code and what had to be re-picked with
        // it, so it is worth reading rather than a tick — see the actions. Both
        // of them always set one; the heading is only a floor.
        toast.success(result.message ?? title, { duration: 10_000 });
        setSchoolId("");
      } else {
        // Likewise: a refusal names what is holding the record where it is.
        toast.error(result.message ?? t.errors.unexpected, { duration: 10_000 });
      }
    });
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <SchoolIcon className="size-4" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-wrap items-end gap-3 pt-6">
        <div className="grid min-w-56 flex-1 gap-1.5">
          <Label htmlFor="moveToSchool">{label}</Label>
          <Select value={schoolId} onValueChange={setSchoolId}>
            <SelectTrigger id="moveToSchool">
              <SelectValue placeholder={t.common.select} />
            </SelectTrigger>
            <SelectContent>
              {schools.map((school) => (
                <SelectItem key={school.id} value={school.id}>
                  {school.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={move}
          disabled={pending || !schoolId}
        >
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          {confirmLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
