"use client";

import * as React from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { localKey } from "@/lib/local-key";
import { ROOM_KINDS } from "@/modules/facilities/enums";
import type { SetupState } from "@/modules/setup/components/use-setup-state";

/**
 * Where lessons happen.
 *
 * The table starts sized to the classes being opened and the labs the chosen
 * programme actually needs — a school that teaches no science is not offered
 * two laboratoires. Touching any cell takes the table over, so a room the
 * school renamed is not overwritten the next time the classes step changes.
 */
export function RoomsStep({
  setup,
  error,
}: {
  setup: SetupState;
  error?: string;
}) {
  const t = useT();
  const rows = setup.rooms.rows;

  function edit(key: string, patch: Parameters<typeof setup.rooms.updateRoom>[1]) {
    setup.rooms.takeOverRooms();
    setup.rooms.updateRoom(key, patch);
  }

  return (
    <div className="grid gap-3">
      <p className="text-muted-foreground text-xs">{t.setup.rooms.generated}</p>
      {error ? (
        <p role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      ) : null}

      <div className="hidden gap-2 px-2 sm:grid sm:grid-cols-[8rem_1fr_10rem_10rem_5rem_6rem_auto]">
        <Label className="text-muted-foreground text-xs">{t.setup.rooms.code}</Label>
        <Label className="text-muted-foreground text-xs">{t.setup.rooms.name}</Label>
        <Label className="text-muted-foreground text-xs">{t.setup.rooms.kind}</Label>
        <Label className="text-muted-foreground text-xs">{t.setup.rooms.building}</Label>
        <Label className="text-muted-foreground text-xs">{t.setup.rooms.floor}</Label>
        <Label className="text-muted-foreground text-xs">{t.setup.rooms.capacity}</Label>
        <span />
      </div>

      {rows.map((room) => (
        <div
          key={room.key}
          className="grid gap-2 sm:grid-cols-[8rem_1fr_10rem_10rem_5rem_6rem_auto]"
        >
          <Input
            aria-label={t.setup.rooms.code}
            dir="ltr"
            className="uppercase"
            value={room.code}
            onChange={(event) => edit(room.key, { code: event.target.value })}
          />
          <Input
            aria-label={t.setup.rooms.name}
            value={room.name}
            onChange={(event) => edit(room.key, { name: event.target.value })}
          />
          <Select value={room.kind} onValueChange={(value) => edit(room.key, { kind: value })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROOM_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {t.configOptions.roomKinds[kind]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            aria-label={t.setup.rooms.building}
            value={room.building}
            onChange={(event) => edit(room.key, { building: event.target.value })}
          />
          <Input
            aria-label={t.setup.rooms.floor}
            type="number"
            min={0}
            value={room.floor}
            onChange={(event) => edit(room.key, { floor: event.target.value })}
          />
          <Input
            aria-label={t.setup.rooms.capacity}
            type="number"
            min={0}
            value={room.capacity}
            onChange={(event) => edit(room.key, { capacity: event.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t.setup.removeRow}
            onClick={() => {
              setup.rooms.takeOverRooms();
              setup.rooms.setRooms((current) =>
                (current ?? rows).filter((item) => item.key !== room.key),
              );
            }}
          >
            <Trash2Icon className="size-4" />
          </Button>
        </div>
      ))}

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setup.rooms.takeOverRooms();
            setup.rooms.setRooms((current) => [
              ...(current ?? rows),
              {
                key: localKey("room"),
                code: "",
                name: "",
                kind: "CLASSROOM",
                building: "",
                floor: "",
                capacity: "",
              },
            ]);
          }}
        >
          <PlusIcon className="size-4" />
          {t.setup.rooms.addRoom}
        </Button>
      </div>
    </div>
  );
}

/** Six parallel arrays, one value per row in each. */
export function RoomsInputs({ setup }: { setup: SetupState }) {
  return (
    <>
      {setup.rooms.rows.map((room) => (
        <React.Fragment key={room.key}>
          <input type="hidden" name="roomCode" value={room.code} />
          <input type="hidden" name="roomName" value={room.name} />
          <input type="hidden" name="roomKind" value={room.kind} />
          <input type="hidden" name="roomBuilding" value={room.building} />
          <input type="hidden" name="roomFloor" value={room.floor} />
          <input type="hidden" name="roomCapacity" value={room.capacity} />
        </React.Fragment>
      ))}
    </>
  );
}
