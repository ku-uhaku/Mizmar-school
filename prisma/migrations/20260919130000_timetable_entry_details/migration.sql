-- AlterTable
ALTER TABLE `timetable_entries` DROP COLUMN `endTime`,
    DROP COLUMN `startTime`;

-- CreateTable
CREATE TABLE `timetable_entry_details` (
    `id` VARCHAR(30) NOT NULL,
    `entryId` VARCHAR(30) NOT NULL,
    `subjectId` VARCHAR(30) NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `timetable_entry_details_entryId_idx`(`entryId`),
    INDEX `timetable_entry_details_subjectId_idx`(`subjectId`),
    UNIQUE INDEX `timetable_entry_details_entryId_subjectId_startTime_key`(`entryId`, `subjectId`, `startTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `timetable_entry_details` ADD CONSTRAINT `timetable_entry_details_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `timetable_entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_entry_details` ADD CONSTRAINT `timetable_entry_details_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

