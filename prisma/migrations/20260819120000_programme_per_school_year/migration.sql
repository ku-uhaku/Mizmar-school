-- The programme belongs to a school year.
--
-- `level_subjects` hung off the niveau alone, so one edit to a coefficient or a
-- volume horaire rewrote what every past bulletin had been computed from and
-- what last year's timetable was drawn to. It now joins the year, like
-- everything else a school redraws each rentrée — see the note on the model.
--
-- Added nullable, backfilled, then tightened: the column is required and the
-- table is not empty, so there is no order in which a bare NOT NULL would apply.

-- AlterTable
ALTER TABLE `level_subjects` ADD COLUMN `schoolYearId` VARCHAR(30) NULL;

-- Backfill: the school's own current year, reached through the niveau.
--
-- One year per school, chosen the way the app chooses it — the default year
-- first, then the most recently started. That is the year the existing rows were
-- last edited under, so the programme carries on saying about this year exactly
-- what it said before; every earlier year starts empty and is filled by copying,
-- which is the honest answer for a history nobody recorded.
UPDATE `level_subjects` AS `ls`
JOIN `levels` AS `l` ON `l`.`id` = `ls`.`levelId`
JOIN (
  SELECT `id`, `schoolId`
  FROM (
    SELECT
      `id`,
      `schoolId`,
      ROW_NUMBER() OVER (
        PARTITION BY `schoolId`
        ORDER BY `isDefault` DESC, `startDate` DESC, `id`
      ) AS `seat`
    FROM `school_years`
  ) AS `ranked`
  WHERE `seat` = 1
) AS `pick` ON `pick`.`schoolId` = `l`.`schoolId`
SET `ls`.`schoolYearId` = `pick`.`id`;

-- What is left is a programme in a school that has never opened a year. Nothing
-- can reach it — a class hangs off a LevelOffering, which hangs off a year — and
-- it cannot be given one, so it goes rather than holding the NOT NULL back.
DELETE FROM `level_subjects` WHERE `schoolYearId` IS NULL;

-- AlterTable
ALTER TABLE `level_subjects` MODIFY `schoolYearId` VARCHAR(30) NOT NULL;

-- DropIndex
DROP INDEX `level_subjects_levelId_subjectId_scopeKey_key` ON `level_subjects`;

-- CreateIndex
CREATE UNIQUE INDEX `level_subjects_schoolYearId_levelId_subjectId_scopeKey_key` ON `level_subjects`(`schoolYearId`, `levelId`, `subjectId`, `scopeKey`);

-- CreateIndex
CREATE INDEX `level_subjects_schoolYearId_idx` ON `level_subjects`(`schoolYearId`);

-- AddForeignKey
ALTER TABLE `level_subjects` ADD CONSTRAINT `level_subjects_schoolYearId_fkey` FOREIGN KEY (`schoolYearId`) REFERENCES `school_years`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
