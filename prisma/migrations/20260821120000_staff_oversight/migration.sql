-- CreateTable
CREATE TABLE `staff_oversights` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `schoolYearId` VARCHAR(30) NOT NULL,
    `staffId` VARCHAR(30) NOT NULL,
    `educationLevelId` VARCHAR(30) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `staff_oversights_schoolId_idx`(`schoolId`),
    INDEX `staff_oversights_schoolYearId_idx`(`schoolYearId`),
    INDEX `staff_oversights_staffId_idx`(`staffId`),
    INDEX `staff_oversights_educationLevelId_idx`(`educationLevelId`),
    INDEX `staff_oversights_schoolYearId_educationLevelId_idx`(`schoolYearId`, `educationLevelId`),
    UNIQUE INDEX `staff_oversights_schoolYearId_staffId_educationLevelId_key`(`schoolYearId`, `staffId`, `educationLevelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `staff_oversights` ADD CONSTRAINT `staff_oversights_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_oversights` ADD CONSTRAINT `staff_oversights_schoolYearId_fkey` FOREIGN KEY (`schoolYearId`) REFERENCES `school_years`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_oversights` ADD CONSTRAINT `staff_oversights_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_oversights` ADD CONSTRAINT `staff_oversights_educationLevelId_fkey` FOREIGN KEY (`educationLevelId`) REFERENCES `education_levels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

