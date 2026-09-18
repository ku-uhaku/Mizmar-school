-- AlterTable
ALTER TABLE `student_attendance` DROP COLUMN `lockedAt`,
    ADD COLUMN `sessionId` VARCHAR(30) NULL;

-- CreateTable
CREATE TABLE `class_sessions` (
    `id` VARCHAR(30) NOT NULL,
    `schoolClassId` VARCHAR(30) NOT NULL,
    `classGroupId` VARCHAR(30) NULL,
    `timetableEntryId` VARCHAR(30) NULL,
    `timeSlotId` VARCHAR(30) NULL,
    `date` DATETIME(3) NOT NULL,
    `subjectId` VARCHAR(30) NULL,
    `teacherId` VARCHAR(30) NULL,
    `theme` TEXT NULL,
    `homework` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'HELD',
    `closedAt` DATETIME(3) NULL,
    `closedById` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `scopeKey` VARCHAR(80) NOT NULL,

    INDEX `class_sessions_schoolClassId_date_idx`(`schoolClassId`, `date`),
    INDEX `class_sessions_classGroupId_idx`(`classGroupId`),
    INDEX `class_sessions_timetableEntryId_idx`(`timetableEntryId`),
    INDEX `class_sessions_timeSlotId_idx`(`timeSlotId`),
    INDEX `class_sessions_subjectId_idx`(`subjectId`),
    INDEX `class_sessions_teacherId_idx`(`teacherId`),
    INDEX `class_sessions_closedById_idx`(`closedById`),
    UNIQUE INDEX `class_sessions_schoolClassId_date_scopeKey_key`(`schoolClassId`, `date`, `scopeKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `student_attendance_sessionId_idx` ON `student_attendance`(`sessionId`);

-- AddForeignKey
ALTER TABLE `class_sessions` ADD CONSTRAINT `class_sessions_schoolClassId_fkey` FOREIGN KEY (`schoolClassId`) REFERENCES `classes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_sessions` ADD CONSTRAINT `class_sessions_classGroupId_fkey` FOREIGN KEY (`classGroupId`) REFERENCES `class_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_sessions` ADD CONSTRAINT `class_sessions_timetableEntryId_fkey` FOREIGN KEY (`timetableEntryId`) REFERENCES `timetable_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_sessions` ADD CONSTRAINT `class_sessions_timeSlotId_fkey` FOREIGN KEY (`timeSlotId`) REFERENCES `time_slots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_sessions` ADD CONSTRAINT `class_sessions_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_sessions` ADD CONSTRAINT `class_sessions_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_sessions` ADD CONSTRAINT `class_sessions_closedById_fkey` FOREIGN KEY (`closedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_attendance` ADD CONSTRAINT `student_attendance_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `class_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
