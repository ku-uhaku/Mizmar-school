-- AlterTable
ALTER TABLE `levels` ADD COLUMN `reportMaxScore` INTEGER NULL;

-- CreateTable
CREATE TABLE `grading_rules` (
    `id` VARCHAR(30) NOT NULL,
    `schoolYearId` VARCHAR(30) NOT NULL,
    `assessmentTypeId` VARCHAR(30) NOT NULL,
    `levelId` VARCHAR(30) NULL,
    `subjectId` VARCHAR(30) NULL,
    `maxScore` INTEGER NOT NULL,
    `coefficient` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `scopeKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `grading_rules_schoolYearId_idx`(`schoolYearId`),
    INDEX `grading_rules_assessmentTypeId_idx`(`assessmentTypeId`),
    INDEX `grading_rules_levelId_idx`(`levelId`),
    INDEX `grading_rules_subjectId_idx`(`subjectId`),
    UNIQUE INDEX `grading_rules_schoolYearId_assessmentTypeId_scopeKey_key`(`schoolYearId`, `assessmentTypeId`, `scopeKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `grading_rules` ADD CONSTRAINT `grading_rules_schoolYearId_fkey` FOREIGN KEY (`schoolYearId`) REFERENCES `school_years`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grading_rules` ADD CONSTRAINT `grading_rules_assessmentTypeId_fkey` FOREIGN KEY (`assessmentTypeId`) REFERENCES `assessment_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grading_rules` ADD CONSTRAINT `grading_rules_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `levels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grading_rules` ADD CONSTRAINT `grading_rules_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
