-- AlterTable
ALTER TABLE `timetable_entries` ADD COLUMN `versionId` VARCHAR(30) NULL;

-- CreateTable
CREATE TABLE `timetable_versions` (
    `id` VARCHAR(30) NOT NULL,
    `schoolYearId` VARCHAR(30) NOT NULL,
    `scheduleKind` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `activeKey` VARCHAR(80) NULL,
    `label` VARCHAR(200) NULL,
    `seed` INTEGER NULL,
    `createdById` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `timetable_versions_schoolYearId_scheduleKind_idx`(`schoolYearId`, `scheduleKind`),
    UNIQUE INDEX `timetable_versions_activeKey_key`(`activeKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `timetable_entries_versionId_idx` ON `timetable_entries`(`versionId`);

-- AddForeignKey
ALTER TABLE `timetable_entries` ADD CONSTRAINT `timetable_entries_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `timetable_versions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_versions` ADD CONSTRAINT `timetable_versions_schoolYearId_fkey` FOREIGN KEY (`schoolYearId`) REFERENCES `school_years`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_versions` ADD CONSTRAINT `timetable_versions_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
