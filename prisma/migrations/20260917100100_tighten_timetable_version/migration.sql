-- Tighten TimetableEntry.versionId to required now that
-- scripts/backfill-timetable-versions.ts has tagged every existing row.
--
-- Dropping the old unique index does not require touching the schoolClassId
-- foreign key: it is also backed by timetable_entries_schoolClassId_idx and
-- timetable_entries_schoolClassId_fromWeek_idx, either of which is enough for
-- InnoDB to keep enforcing it.
ALTER TABLE `timetable_entries` MODIFY `versionId` VARCHAR(30) NOT NULL;

DROP INDEX `timetable_entries_schoolClassId_timeSlotId_bookingKey_key` ON `timetable_entries`;

-- Superseded by the compound unique below, which leads with the same column.
DROP INDEX `timetable_entries_versionId_idx` ON `timetable_entries`;

CREATE UNIQUE INDEX `timetable_entries_versionId_schoolClassId_timeSlotId_booking_key`
  ON `timetable_entries`(`versionId`, `schoolClassId`, `timeSlotId`, `bookingKey`);
