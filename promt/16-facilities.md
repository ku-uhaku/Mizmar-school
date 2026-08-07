# 16 — `facilities`

**Prereqs:** 07.
**Table:** `Room`. **No route** — edited under `/configuration` (prompt 18).

---

Deliberately tiny, deliberately its own module: the timetable needs to book
rooms, and a room is not an academic concept.

**`Room`** — `schoolId` (Cascade), `code`, `name?`,
`kind String @default("CLASSROOM")` (native enum: `CLASSROOM | LAB | SPORTS |
COMPUTER | LIBRARY | OTHER`), `building?`, `floor Int?`, `capacity Int?`,
`isActive`, `notes?`. `@@unique([schoolId, code])`.

**Queries:** `listRooms(ctx)`, `roomOptions(ctx, { kind? })`, and
`roomsFreeAt(ctx, timeSlotId)` — leave the last one exported and returning all
active rooms for now; prompt 23 fills in the booking check. Declaring it here
keeps the room-conflict logic in the module that owns rooms.

**No permission codes** — `configuration.manage`.

**Gate:** typecheck + seed a dozen rooms including a lab and a sports hall.
