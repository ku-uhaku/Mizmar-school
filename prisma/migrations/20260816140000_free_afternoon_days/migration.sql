-- AlterTable
ALTER TABLE `school_settings` DROP COLUMN `freeAfternoonDay`,
    ADD COLUMN `freeAfternoonDays` VARCHAR(191) NOT NULL DEFAULT '';
