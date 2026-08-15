-- CreateTable
CREATE TABLE `education_levels` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `cycle` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `education_levels_schoolId_idx`(`schoolId`),
    UNIQUE INDEX `education_levels_schoolId_cycle_key`(`schoolId`, `cycle`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `level_subjects` (
    `id` VARCHAR(30) NOT NULL,
    `levelId` VARCHAR(30) NOT NULL,
    `trackId` VARCHAR(30) NULL,
    `subjectId` VARCHAR(30) NOT NULL,
    `coefficient` INTEGER NOT NULL DEFAULT 1,
    `weeklyMinutes` INTEGER NULL,
    `isGraded` BOOLEAN NOT NULL DEFAULT true,
    `isEliminatory` BOOLEAN NOT NULL DEFAULT false,
    `position` INTEGER NOT NULL DEFAULT 0,
    `scopeKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `level_subjects_levelId_idx`(`levelId`),
    INDEX `level_subjects_trackId_idx`(`trackId`),
    INDEX `level_subjects_subjectId_idx`(`subjectId`),
    UNIQUE INDEX `level_subjects_levelId_subjectId_scopeKey_key`(`levelId`, `subjectId`, `scopeKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `levels` (
    `id` VARCHAR(30) NOT NULL,
    `educationLevelId` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `massarCode` VARCHAR(191) NULL,
    `gradeYear` INTEGER NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `levels_educationLevelId_idx`(`educationLevelId`),
    INDEX `levels_schoolId_idx`(`schoolId`),
    UNIQUE INDEX `levels_schoolId_code_key`(`schoolId`, `code`),
    UNIQUE INDEX `levels_schoolId_massarCode_key`(`schoolId`, `massarCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subjects` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `shortName` VARCHAR(191) NULL,
    `massarCode` VARCHAR(191) NULL,
    `parentId` VARCHAR(30) NULL,
    `colorHex` VARCHAR(191) NULL,
    `isLanguage` BOOLEAN NOT NULL DEFAULT false,
    `requiresLab` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `subjects_schoolId_idx`(`schoolId`),
    INDEX `subjects_parentId_idx`(`parentId`),
    UNIQUE INDEX `subjects_schoolId_code_key`(`schoolId`, `code`),
    UNIQUE INDEX `subjects_schoolId_massarCode_key`(`schoolId`, `massarCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tracks` (
    `id` VARCHAR(30) NOT NULL,
    `levelId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `massarCode` VARCHAR(191) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `tracks_levelId_idx`(`levelId`),
    UNIQUE INDEX `tracks_levelId_code_key`(`levelId`, `code`),
    UNIQUE INDEX `tracks_levelId_massarCode_key`(`levelId`, `massarCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `memberships` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `roleId` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `memberships_schoolId_idx`(`schoolId`),
    INDEX `memberships_roleId_idx`(`roleId`),
    UNIQUE INDEX `memberships_userId_schoolId_key`(`userId`, `schoolId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `group` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,

    UNIQUE INDEX `permissions_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `roleId` VARCHAR(30) NOT NULL,
    `permissionId` VARCHAR(30) NOT NULL,

    INDEX `role_permissions_permissionId_idx`(`permissionId`),
    PRIMARY KEY (`roleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` VARCHAR(30) NOT NULL,
    `organizationId` VARCHAR(30) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `scope` VARCHAR(191) NOT NULL DEFAULT 'SCHOOL',
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `roles_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `roles_organizationId_name_key`(`organizationId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `appreciation_bands` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `minPercentBps` INTEGER NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `labelAr` VARCHAR(191) NULL,
    `colorHex` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `appreciation_bands_schoolId_idx`(`schoolId`),
    UNIQUE INDEX `appreciation_bands_schoolId_minPercentBps_key`(`schoolId`, `minPercentBps`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assessment_grades` (
    `id` VARCHAR(30) NOT NULL,
    `assessmentId` VARCHAR(30) NOT NULL,
    `enrollmentId` VARCHAR(30) NOT NULL,
    `score` DOUBLE NULL,
    `isAbsent` BOOLEAN NOT NULL DEFAULT false,
    `isExcused` BOOLEAN NOT NULL DEFAULT false,
    `comment` TEXT NULL,
    `gradedById` VARCHAR(30) NULL,
    `gradedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `assessment_grades_assessmentId_idx`(`assessmentId`),
    INDEX `assessment_grades_enrollmentId_idx`(`enrollmentId`),
    INDEX `assessment_grades_gradedById_idx`(`gradedById`),
    UNIQUE INDEX `assessment_grades_assessmentId_enrollmentId_key`(`assessmentId`, `enrollmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assessment_questions` (
    `id` VARCHAR(30) NOT NULL,
    `assessmentId` VARCHAR(30) NOT NULL,
    `position` INTEGER NOT NULL,
    `text` TEXT NOT NULL,
    `pointsQuarters` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `assessment_questions_assessmentId_idx`(`assessmentId`),
    UNIQUE INDEX `assessment_questions_assessmentId_position_key`(`assessmentId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assessment_types` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `defaultCoefficient` INTEGER NOT NULL DEFAULT 1,
    `defaultMaxScore` INTEGER NOT NULL DEFAULT 20,
    `countsTowardAverage` BOOLEAN NOT NULL DEFAULT true,
    `gradesWholeSubject` BOOLEAN NOT NULL DEFAULT false,
    `allowTeacherCreate` BOOLEAN NOT NULL DEFAULT false,
    `colorHex` VARCHAR(191) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `assessment_types_schoolId_idx`(`schoolId`),
    UNIQUE INDEX `assessment_types_schoolId_code_key`(`schoolId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assessments` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `schoolClassId` VARCHAR(30) NOT NULL,
    `classGroupId` VARCHAR(30) NULL,
    `subjectId` VARCHAR(30) NOT NULL,
    `termId` VARCHAR(30) NOT NULL,
    `assessmentTypeId` VARCHAR(30) NOT NULL,
    `sequence` INTEGER NOT NULL DEFAULT 1,
    `title` VARCHAR(191) NOT NULL,
    `scheduledOn` DATETIME(3) NULL,
    `maxScore` INTEGER NOT NULL DEFAULT 20,
    `coefficient` INTEGER NOT NULL DEFAULT 1,
    `countsTowardAverage` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `teacherId` VARCHAR(30) NULL,
    `createdById` VARCHAR(30) NULL,
    `notes` TEXT NULL,
    `massarCode` VARCHAR(191) NULL,
    `scopeKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `assessments_schoolId_idx`(`schoolId`),
    INDEX `assessments_schoolClassId_idx`(`schoolClassId`),
    INDEX `assessments_classGroupId_idx`(`classGroupId`),
    INDEX `assessments_subjectId_idx`(`subjectId`),
    INDEX `assessments_termId_idx`(`termId`),
    INDEX `assessments_assessmentTypeId_idx`(`assessmentTypeId`),
    INDEX `assessments_teacherId_idx`(`teacherId`),
    INDEX `assessments_createdById_idx`(`createdById`),
    UNIQUE INDEX `assessments_schoolClassId_subjectId_termId_assessmentTypeId__key`(`schoolClassId`, `subjectId`, `termId`, `assessmentTypeId`, `sequence`, `scopeKey`),
    UNIQUE INDEX `assessments_schoolId_massarCode_key`(`schoolId`, `massarCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_logs` (
    `id` VARCHAR(30) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `schoolId` VARCHAR(191) NULL,
    `schoolYearId` VARCHAR(191) NULL,
    `actorId` VARCHAR(191) NULL,
    `actorLabel` VARCHAR(191) NOT NULL,
    `actorEmail` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `entityLabel` VARCHAR(191) NULL,
    `changes` VARCHAR(191) NULL,
    `metadata` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `activity_logs_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    INDEX `activity_logs_schoolId_createdAt_idx`(`schoolId`, `createdAt`),
    INDEX `activity_logs_actorId_createdAt_idx`(`actorId`, `createdAt`),
    INDEX `activity_logs_action_createdAt_idx`(`action`, `createdAt`),
    INDEX `activity_logs_entity_entityId_createdAt_idx`(`entity`, `entityId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_attempts` (
    `id` VARCHAR(30) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `failedCount` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `lastFailedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `login_attempts_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `discounts` (
    `id` VARCHAR(30) NOT NULL,
    `schoolYearId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `kind` VARCHAR(191) NOT NULL,
    `percentBps` INTEGER NULL,
    `amountCentimes` INTEGER NULL,
    `reason` VARCHAR(191) NOT NULL DEFAULT 'OTHER',
    `feeTypeId` VARCHAR(30) NULL,
    `isStackable` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `discounts_schoolYearId_idx`(`schoolYearId`),
    INDEX `discounts_feeTypeId_idx`(`feeTypeId`),
    UNIQUE INDEX `discounts_schoolYearId_code_key`(`schoolYearId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fee_rates` (
    `id` VARCHAR(30) NOT NULL,
    `schoolYearId` VARCHAR(30) NOT NULL,
    `feeTypeId` VARCHAR(30) NOT NULL,
    `levelId` VARCHAR(30) NULL,
    `amountCentimes` INTEGER NOT NULL,
    `instalmentCount` INTEGER NULL,
    `perInstalment` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `scopeKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `fee_rates_schoolYearId_idx`(`schoolYearId`),
    INDEX `fee_rates_feeTypeId_idx`(`feeTypeId`),
    INDEX `fee_rates_levelId_idx`(`levelId`),
    UNIQUE INDEX `fee_rates_schoolYearId_feeTypeId_scopeKey_key`(`schoolYearId`, `feeTypeId`, `scopeKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fee_types` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'OTHER',
    `billingCycle` VARCHAR(191) NOT NULL DEFAULT 'ANNUAL',
    `isMandatory` BOOLEAN NOT NULL DEFAULT true,
    `position` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `fee_types_schoolId_idx`(`schoolId`),
    UNIQUE INDEX `fee_types_schoolId_code_key`(`schoolId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bulletin_lines` (
    `id` VARCHAR(30) NOT NULL,
    `bulletinId` VARCHAR(30) NOT NULL,
    `subjectId` VARCHAR(30) NOT NULL,
    `parentSubjectId` VARCHAR(30) NULL,
    `subjectName` VARCHAR(191) NOT NULL,
    `teacherName` VARCHAR(191) NULL,
    `coefficient` INTEGER NOT NULL DEFAULT 1,
    `average` DOUBLE NULL,
    `markCount` INTEGER NOT NULL DEFAULT 0,
    `rank` INTEGER NULL,
    `classAverage` DOUBLE NULL,
    `classLowest` DOUBLE NULL,
    `classHighest` DOUBLE NULL,
    `appreciation` TEXT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `bulletin_lines_bulletinId_idx`(`bulletinId`),
    INDEX `bulletin_lines_subjectId_idx`(`subjectId`),
    INDEX `bulletin_lines_parentSubjectId_idx`(`parentSubjectId`),
    UNIQUE INDEX `bulletin_lines_bulletinId_subjectId_key`(`bulletinId`, `subjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bulletins` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `enrollmentId` VARCHAR(30) NOT NULL,
    `termId` VARCHAR(30) NOT NULL,
    `schoolClassId` VARCHAR(30) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `generalAverage` DOUBLE NULL,
    `outOf` INTEGER NOT NULL DEFAULT 20,
    `rank` INTEGER NULL,
    `classSize` INTEGER NOT NULL DEFAULT 0,
    `classAverage` DOUBLE NULL,
    `classLowest` DOUBLE NULL,
    `classHighest` DOUBLE NULL,
    `absenceCount` INTEGER NOT NULL DEFAULT 0,
    `unjustifiedAbsenceCount` INTEGER NOT NULL DEFAULT 0,
    `lateCount` INTEGER NOT NULL DEFAULT 0,
    `mention` VARCHAR(191) NULL,
    `decision` VARCHAR(191) NULL,
    `councilComment` TEXT NULL,
    `mainTeacherComment` TEXT NULL,
    `computedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `publishedAt` DATETIME(3) NULL,
    `publishedById` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `bulletins_schoolId_idx`(`schoolId`),
    INDEX `bulletins_termId_idx`(`termId`),
    INDEX `bulletins_schoolClassId_idx`(`schoolClassId`),
    INDEX `bulletins_schoolClassId_termId_idx`(`schoolClassId`, `termId`),
    INDEX `bulletins_enrollmentId_idx`(`enrollmentId`),
    UNIQUE INDEX `bulletins_enrollmentId_termId_key`(`enrollmentId`, `termId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_channels` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `schoolYearId` VARCHAR(30) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `schoolClassId` VARCHAR(191) NULL,
    `generalKey` VARCHAR(191) NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `chat_channels_schoolClassId_key`(`schoolClassId`),
    INDEX `chat_channels_schoolId_idx`(`schoolId`),
    INDEX `chat_channels_schoolYearId_kind_idx`(`schoolYearId`, `kind`),
    INDEX `chat_channels_schoolClassId_idx`(`schoolClassId`),
    UNIQUE INDEX `chat_channels_generalKey_key`(`generalKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_messages` (
    `id` VARCHAR(30) NOT NULL,
    `channelId` VARCHAR(30) NOT NULL,
    `authorId` VARCHAR(30) NOT NULL,
    `body` TEXT NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedById` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `chat_messages_authorId_idx`(`authorId`),
    INDEX `chat_messages_deletedById_idx`(`deletedById`),
    INDEX `chat_messages_channelId_deletedAt_createdAt_idx`(`channelId`, `deletedAt`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `class_groups` (
    `id` VARCHAR(30) NOT NULL,
    `schoolClassId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `purpose` VARCHAR(191) NOT NULL DEFAULT 'OTHER',
    `subjectId` VARCHAR(30) NULL,
    `capacity` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `class_groups_schoolClassId_idx`(`schoolClassId`),
    INDEX `class_groups_subjectId_idx`(`subjectId`),
    UNIQUE INDEX `class_groups_schoolClassId_code_key`(`schoolClassId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `level_offerings` (
    `id` VARCHAR(30) NOT NULL,
    `schoolYearId` VARCHAR(30) NOT NULL,
    `levelId` VARCHAR(30) NOT NULL,
    `trackId` VARCHAR(30) NULL,
    `plannedCapacity` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `scopeKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `level_offerings_schoolYearId_idx`(`schoolYearId`),
    INDEX `level_offerings_levelId_idx`(`levelId`),
    INDEX `level_offerings_trackId_idx`(`trackId`),
    UNIQUE INDEX `level_offerings_schoolYearId_levelId_scopeKey_key`(`schoolYearId`, `levelId`, `scopeKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `classes` (
    `id` VARCHAR(30) NOT NULL,
    `levelOfferingId` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `massarCode` VARCHAR(191) NULL,
    `name` VARCHAR(191) NULL,
    `section` VARCHAR(191) NULL,
    `capacity` INTEGER NULL,
    `mainTeacherId` VARCHAR(30) NULL,
    `roomId` VARCHAR(30) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `classes_schoolId_idx`(`schoolId`),
    INDEX `classes_levelOfferingId_idx`(`levelOfferingId`),
    INDEX `classes_mainTeacherId_idx`(`mainTeacherId`),
    INDEX `classes_roomId_idx`(`roomId`),
    UNIQUE INDEX `classes_levelOfferingId_code_key`(`levelOfferingId`, `code`),
    UNIQUE INDEX `classes_schoolId_massarCode_key`(`schoolId`, `massarCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teaching_assignments` (
    `id` VARCHAR(30) NOT NULL,
    `schoolClassId` VARCHAR(30) NOT NULL,
    `classGroupId` VARCHAR(30) NULL,
    `subjectId` VARCHAR(30) NOT NULL,
    `teacherId` VARCHAR(30) NOT NULL,
    `weeklyMinutes` INTEGER NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT true,
    `scopeKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `teaching_assignments_schoolClassId_idx`(`schoolClassId`),
    INDEX `teaching_assignments_classGroupId_idx`(`classGroupId`),
    INDEX `teaching_assignments_subjectId_idx`(`subjectId`),
    INDEX `teaching_assignments_teacherId_idx`(`teacherId`),
    UNIQUE INDEX `teaching_assignments_schoolClassId_subjectId_teacherId_scope_key`(`schoolClassId`, `subjectId`, `teacherId`, `scopeKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_attendance` (
    `id` VARCHAR(30) NOT NULL,
    `enrollmentId` VARCHAR(30) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `timeSlotId` VARCHAR(30) NULL,
    `subjectId` VARCHAR(30) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PRESENT',
    `minutesLate` INTEGER NULL,
    `reason` TEXT NULL,
    `isJustified` BOOLEAN NOT NULL DEFAULT false,
    `recordedById` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `scopeKey` VARCHAR(191) NOT NULL,

    INDEX `student_attendance_enrollmentId_idx`(`enrollmentId`),
    INDEX `student_attendance_timeSlotId_idx`(`timeSlotId`),
    INDEX `student_attendance_subjectId_idx`(`subjectId`),
    INDEX `student_attendance_recordedById_idx`(`recordedById`),
    INDEX `student_attendance_date_idx`(`date`),
    UNIQUE INDEX `student_attendance_enrollmentId_date_scopeKey_key`(`enrollmentId`, `date`, `scopeKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_remarks` (
    `id` VARCHAR(30) NOT NULL,
    `enrollmentId` VARCHAR(30) NOT NULL,
    `subjectId` VARCHAR(30) NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'OTHER',
    `tone` VARCHAR(191) NOT NULL DEFAULT 'NEUTRAL',
    `body` TEXT NOT NULL,
    `occurredOn` DATETIME(3) NOT NULL,
    `isVisibleToFamily` BOOLEAN NOT NULL DEFAULT false,
    `authorId` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `student_remarks_enrollmentId_idx`(`enrollmentId`),
    INDEX `student_remarks_subjectId_idx`(`subjectId`),
    INDEX `student_remarks_authorId_idx`(`authorId`),
    INDEX `student_remarks_occurredOn_idx`(`occurredOn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_types` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `copies` INTEGER NULL,
    `notes` TEXT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `document_types_schoolId_idx`(`schoolId`),
    INDEX `document_types_schoolId_isActive_idx`(`schoolId`, `isActive`),
    UNIQUE INDEX `document_types_schoolId_code_key`(`schoolId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_documents` (
    `id` VARCHAR(30) NOT NULL,
    `studentId` VARCHAR(30) NOT NULL,
    `documentTypeId` VARCHAR(30) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'MISSING',
    `receivedOn` DATETIME(3) NULL,
    `reference` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `recordedById` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `student_documents_studentId_idx`(`studentId`),
    INDEX `student_documents_documentTypeId_idx`(`documentTypeId`),
    UNIQUE INDEX `student_documents_studentId_documentTypeId_key`(`studentId`, `documentTypeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enrollment_fees` (
    `id` VARCHAR(30) NOT NULL,
    `enrollmentId` VARCHAR(30) NOT NULL,
    `feeTypeId` VARCHAR(30) NOT NULL,
    `feeRateId` VARCHAR(30) NULL,
    `periodIndex` INTEGER NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `dueMonth` INTEGER NOT NULL,
    `dueYear` INTEGER NOT NULL,
    `baseAmountCentimes` INTEGER NOT NULL,
    `discountBps` INTEGER NOT NULL DEFAULT 0,
    `discountCentimes` INTEGER NOT NULL DEFAULT 0,
    `discountId` VARCHAR(30) NULL,
    `amountCentimes` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DUE',
    `cancelledAt` DATETIME(3) NULL,
    `cancelReason` TEXT NULL,
    `cancelledById` VARCHAR(30) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `enrollment_fees_enrollmentId_idx`(`enrollmentId`),
    INDEX `enrollment_fees_feeTypeId_idx`(`feeTypeId`),
    INDEX `enrollment_fees_feeRateId_idx`(`feeRateId`),
    INDEX `enrollment_fees_discountId_idx`(`discountId`),
    INDEX `enrollment_fees_cancelledById_idx`(`cancelledById`),
    INDEX `enrollment_fees_dueYear_dueMonth_idx`(`dueYear`, `dueMonth`),
    UNIQUE INDEX `enrollment_fees_enrollmentId_feeTypeId_periodIndex_key`(`enrollmentId`, `feeTypeId`, `periodIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enrollment_options` (
    `id` VARCHAR(30) NOT NULL,
    `enrollmentId` VARCHAR(30) NOT NULL,
    `feeTypeId` VARCHAR(30) NOT NULL,
    `startsOn` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `enrollment_options_enrollmentId_idx`(`enrollmentId`),
    INDEX `enrollment_options_feeTypeId_idx`(`feeTypeId`),
    UNIQUE INDEX `enrollment_options_enrollmentId_feeTypeId_key`(`enrollmentId`, `feeTypeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enrollments` (
    `id` VARCHAR(30) NOT NULL,
    `studentId` VARCHAR(30) NOT NULL,
    `schoolYearId` VARCHAR(30) NOT NULL,
    `levelOfferingId` VARCHAR(30) NOT NULL,
    `schoolClassId` VARCHAR(30) NULL,
    `classGroupId` VARCHAR(30) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `enrolledOn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `leftOn` DATETIME(3) NULL,
    `isRepeating` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `enrollments_schoolYearId_idx`(`schoolYearId`),
    INDEX `enrollments_studentId_idx`(`studentId`),
    INDEX `enrollments_levelOfferingId_idx`(`levelOfferingId`),
    INDEX `enrollments_schoolClassId_idx`(`schoolClassId`),
    INDEX `enrollments_classGroupId_idx`(`classGroupId`),
    INDEX `enrollments_schoolYearId_status_idx`(`schoolYearId`, `status`),
    UNIQUE INDEX `enrollments_studentId_schoolYearId_key`(`studentId`, `schoolYearId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `events` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `schoolYearId` VARCHAR(30) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `titleAr` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'OTHER',
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NULL,
    `isAllDay` BOOLEAN NOT NULL DEFAULT false,
    `location` VARCHAR(191) NULL,
    `isSchoolWide` BOOLEAN NOT NULL DEFAULT true,
    `publishedAt` DATETIME(3) NULL,
    `publishedById` VARCHAR(30) NULL,
    `createdById` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `events_schoolId_idx`(`schoolId`),
    INDEX `events_schoolYearId_idx`(`schoolYearId`),
    INDEX `events_publishedById_idx`(`publishedById`),
    INDEX `events_createdById_idx`(`createdById`),
    INDEX `events_schoolYearId_status_startsAt_idx`(`schoolYearId`, `status`, `startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_audiences` (
    `id` VARCHAR(30) NOT NULL,
    `eventId` VARCHAR(30) NOT NULL,
    `levelId` VARCHAR(30) NULL,
    `schoolClassId` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `event_audiences_eventId_idx`(`eventId`),
    INDEX `event_audiences_levelId_idx`(`levelId`),
    INDEX `event_audiences_schoolClassId_idx`(`schoolClassId`),
    UNIQUE INDEX `event_audiences_eventId_levelId_key`(`eventId`, `levelId`),
    UNIQUE INDEX `event_audiences_eventId_schoolClassId_key`(`eventId`, `schoolClassId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rooms` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'CLASSROOM',
    `building` VARCHAR(191) NULL,
    `floor` INTEGER NULL,
    `capacity` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `rooms_schoolId_idx`(`schoolId`),
    UNIQUE INDEX `rooms_schoolId_code_key`(`schoolId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `families` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `situation` VARCHAR(191) NOT NULL DEFAULT 'MARRIED',
    `addressLine` TEXT NULL,
    `city` VARCHAR(191) NULL,
    `postalCode` VARCHAR(191) NULL,
    `country` VARCHAR(191) NOT NULL DEFAULT 'MA',
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `families_schoolId_idx`(`schoolId`),
    INDEX `families_schoolId_name_idx`(`schoolId`, `name`),
    UNIQUE INDEX `families_schoolId_code_key`(`schoolId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `guardians` (
    `id` VARCHAR(30) NOT NULL,
    `familyId` VARCHAR(30) NOT NULL,
    `relationship` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `nationalId` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `phoneAlt` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `parentJobId` VARCHAR(30) NULL,
    `employer` VARCHAR(191) NULL,
    `addressLine` TEXT NULL,
    `city` VARCHAR(191) NULL,
    `isPrimaryContact` BOOLEAN NOT NULL DEFAULT false,
    `isEmergencyContact` BOOLEAN NOT NULL DEFAULT false,
    `canPickUp` BOOLEAN NOT NULL DEFAULT true,
    `userId` VARCHAR(30) NULL,
    `notes` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `guardians_familyId_idx`(`familyId`),
    INDEX `guardians_userId_idx`(`userId`),
    INDEX `guardians_lastName_idx`(`lastName`),
    INDEX `guardians_parentJobId_idx`(`parentJobId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `parent_jobs` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `parent_jobs_schoolId_idx`(`schoolId`),
    UNIQUE INDEX `parent_jobs_schoolId_code_key`(`schoolId`, `code`),
    UNIQUE INDEX `parent_jobs_schoolId_name_key`(`schoolId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cities` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `region` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `cities_schoolId_idx`(`schoolId`),
    UNIQUE INDEX `cities_schoolId_code_key`(`schoolId`, `code`),
    UNIQUE INDEX `cities_schoolId_name_key`(`schoolId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `neighbourhoods` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `cityId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `landmark` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `neighbourhoods_schoolId_idx`(`schoolId`),
    INDEX `neighbourhoods_cityId_idx`(`cityId`),
    UNIQUE INDEX `neighbourhoods_schoolId_code_key`(`schoolId`, `code`),
    UNIQUE INDEX `neighbourhoods_cityId_name_key`(`cityId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employment_contracts` (
    `id` VARCHAR(30) NOT NULL,
    `staffId` VARCHAR(30) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'CDI',
    `startsOn` DATETIME(3) NOT NULL,
    `endsOn` DATETIME(3) NULL,
    `trialEndsOn` DATETIME(3) NULL,
    `baseSalaryCentimes` INTEGER NOT NULL,
    `weeklyHours` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `activeKey` VARCHAR(191) NULL,

    UNIQUE INDEX `employment_contracts_activeKey_key`(`activeKey`),
    INDEX `employment_contracts_staffId_idx`(`staffId`),
    INDEX `employment_contracts_staffId_startsOn_idx`(`staffId`, `startsOn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_requests` (
    `id` VARCHAR(30) NOT NULL,
    `staffId` VARCHAR(30) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'ANNUAL',
    `startsOn` DATETIME(3) NOT NULL,
    `endsOn` DATETIME(3) NOT NULL,
    `dayCount` INTEGER NOT NULL DEFAULT 1,
    `reason` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `decidedById` VARCHAR(30) NULL,
    `decidedAt` DATETIME(3) NULL,
    `decisionNote` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `leave_requests_staffId_idx`(`staffId`),
    INDEX `leave_requests_staffId_startsOn_idx`(`staffId`, `startsOn`),
    INDEX `leave_requests_status_startsOn_idx`(`status`, `startsOn`),
    INDEX `leave_requests_decidedById_idx`(`decidedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `salary_advances` (
    `id` VARCHAR(30) NOT NULL,
    `staffId` VARCHAR(30) NOT NULL,
    `amountCentimes` INTEGER NOT NULL,
    `instalmentCount` INTEGER NOT NULL DEFAULT 1,
    `status` VARCHAR(191) NOT NULL DEFAULT 'REQUESTED',
    `requestedOn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reason` TEXT NULL,
    `approvedById` VARCHAR(30) NULL,
    `approvedAt` DATETIME(3) NULL,
    `decisionNote` TEXT NULL,
    `paidOn` DATETIME(3) NULL,
    `cashOperationId` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `salary_advances_cashOperationId_key`(`cashOperationId`),
    INDEX `salary_advances_staffId_idx`(`staffId`),
    INDEX `salary_advances_staffId_status_idx`(`staffId`, `status`),
    INDEX `salary_advances_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `salary_advance_recoveries` (
    `id` VARCHAR(30) NOT NULL,
    `advanceId` VARCHAR(30) NOT NULL,
    `salaryPaymentId` VARCHAR(30) NOT NULL,
    `amountCentimes` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `salary_advance_recoveries_advanceId_idx`(`advanceId`),
    INDEX `salary_advance_recoveries_salaryPaymentId_idx`(`salaryPaymentId`),
    UNIQUE INDEX `salary_advance_recoveries_advanceId_salaryPaymentId_key`(`advanceId`, `salaryPaymentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `salary_payments` (
    `id` VARCHAR(30) NOT NULL,
    `staffId` VARCHAR(30) NOT NULL,
    `periodYear` INTEGER NOT NULL,
    `periodMonth` INTEGER NOT NULL,
    `contractId` VARCHAR(30) NULL,
    `baseCentimes` INTEGER NOT NULL DEFAULT 0,
    `allowanceCentimes` INTEGER NOT NULL DEFAULT 0,
    `overtimeCentimes` INTEGER NOT NULL DEFAULT 0,
    `bonusCentimes` INTEGER NOT NULL DEFAULT 0,
    `absenceCentimes` INTEGER NOT NULL DEFAULT 0,
    `advanceCentimes` INTEGER NOT NULL DEFAULT 0,
    `socialCentimes` INTEGER NOT NULL DEFAULT 0,
    `taxCentimes` INTEGER NOT NULL DEFAULT 0,
    `otherDeductionCentimes` INTEGER NOT NULL DEFAULT 0,
    `deductionLabel` VARCHAR(191) NULL,
    `netCentimes` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `paidOn` DATETIME(3) NULL,
    `cashOperationId` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `salary_payments_cashOperationId_key`(`cashOperationId`),
    INDEX `salary_payments_staffId_idx`(`staffId`),
    INDEX `salary_payments_staffId_periodYear_periodMonth_idx`(`staffId`, `periodYear`, `periodMonth`),
    INDEX `salary_payments_periodYear_periodMonth_status_idx`(`periodYear`, `periodMonth`, `status`),
    UNIQUE INDEX `salary_payments_staffId_periodYear_periodMonth_key`(`staffId`, `periodYear`, `periodMonth`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff_attendance` (
    `id` VARCHAR(30) NOT NULL,
    `staffId` VARCHAR(30) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PRESENT',
    `isJustified` BOOLEAN NOT NULL DEFAULT false,
    `minutesLate` INTEGER NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `recordedById` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `staff_attendance_staffId_idx`(`staffId`),
    INDEX `staff_attendance_staffId_date_idx`(`staffId`, `date`),
    INDEX `staff_attendance_date_status_idx`(`date`, `status`),
    INDEX `staff_attendance_recordedById_idx`(`recordedById`),
    UNIQUE INDEX `staff_attendance_staffId_date_key`(`staffId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `code` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `firstNameAr` VARCHAR(191) NULL,
    `lastNameAr` VARCHAR(191) NULL,
    `gender` VARCHAR(191) NULL,
    `birthDate` DATETIME(3) NULL,
    `birthPlace` VARCHAR(191) NULL,
    `nationalId` VARCHAR(191) NULL,
    `cnssNumber` VARCHAR(191) NULL,
    `bankRib` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `jobRole` VARCHAR(191) NOT NULL DEFAULT 'TEACHER',
    `jobTitle` VARCHAR(191) NULL,
    `maxWeeklyMinutes` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `hiredOn` DATETIME(3) NULL,
    `leftOn` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `staff_userId_key`(`userId`),
    INDEX `staff_schoolId_idx`(`schoolId`),
    INDEX `staff_schoolId_lastName_idx`(`schoolId`, `lastName`),
    INDEX `staff_schoolId_status_idx`(`schoolId`, `status`),
    INDEX `staff_schoolId_jobRole_idx`(`schoolId`, `jobRole`),
    UNIQUE INDEX `staff_schoolId_code_key`(`schoolId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teacher_subject_levels` (
    `id` VARCHAR(30) NOT NULL,
    `teacherSubjectId` VARCHAR(30) NOT NULL,
    `levelId` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `teacher_subject_levels_teacherSubjectId_idx`(`teacherSubjectId`),
    INDEX `teacher_subject_levels_levelId_idx`(`levelId`),
    UNIQUE INDEX `teacher_subject_levels_teacherSubjectId_levelId_key`(`teacherSubjectId`, `levelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teacher_subjects` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `schoolYearId` VARCHAR(30) NOT NULL,
    `teacherId` VARCHAR(30) NOT NULL,
    `subjectId` VARCHAR(30) NOT NULL,
    `educationLevelId` VARCHAR(30) NULL,
    `preferenceRank` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `teacher_subjects_schoolId_idx`(`schoolId`),
    INDEX `teacher_subjects_schoolYearId_idx`(`schoolYearId`),
    INDEX `teacher_subjects_teacherId_idx`(`teacherId`),
    INDEX `teacher_subjects_subjectId_idx`(`subjectId`),
    INDEX `teacher_subjects_educationLevelId_idx`(`educationLevelId`),
    INDEX `teacher_subjects_schoolYearId_subjectId_idx`(`schoolYearId`, `subjectId`),
    UNIQUE INDEX `teacher_subjects_schoolYearId_teacherId_subjectId_key`(`schoolYearId`, `teacherId`, `subjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(30) NOT NULL,
    `organizationId` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NULL,
    `userId` VARCHAR(30) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `params` VARCHAR(1000) NOT NULL DEFAULT '{}',
    `subjectId` VARCHAR(191) NULL,
    `studentId` VARCHAR(30) NULL,
    `dedupeKey` VARCHAR(191) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `notifications_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `notifications_userId_readAt_idx`(`userId`, `readAt`),
    INDEX `notifications_organizationId_idx`(`organizationId`),
    INDEX `notifications_schoolId_idx`(`schoolId`),
    INDEX `notifications_studentId_idx`(`studentId`),
    UNIQUE INDEX `notifications_userId_dedupeKey_key`(`userId`, `dedupeKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organizations` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `legalName` VARCHAR(191) NULL,
    `ice` VARCHAR(191) NULL,
    `taxId` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `addressLine` TEXT NULL,
    `city` VARCHAR(191) NULL,
    `region` VARCHAR(191) NULL,
    `postalCode` VARCHAR(191) NULL,
    `country` VARCHAR(191) NOT NULL DEFAULT 'MA',
    `logoUrl` MEDIUMTEXT NULL,
    `defaultLocale` VARCHAR(191) NOT NULL DEFAULT 'fr',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `portal_seen` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `topic` VARCHAR(191) NOT NULL,
    `seenAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `portal_seen_userId_idx`(`userId`),
    UNIQUE INDEX `portal_seen_userId_topic_key`(`userId`, `topic`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `report_favourites` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `reportId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `report_favourites_userId_idx`(`userId`),
    UNIQUE INDEX `report_favourites_userId_reportId_key`(`userId`, `reportId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_request_types` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `descriptionAr` TEXT NULL,
    `usualDelayDays` INTEGER NULL,
    `requiresReason` BOOLEAN NOT NULL DEFAULT false,
    `position` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `document_request_types_schoolId_idx`(`schoolId`),
    INDEX `document_request_types_schoolId_isActive_idx`(`schoolId`, `isActive`),
    UNIQUE INDEX `document_request_types_schoolId_code_key`(`schoolId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_requests` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `studentId` VARCHAR(30) NOT NULL,
    `requestedById` VARCHAR(30) NULL,
    `typeId` VARCHAR(30) NOT NULL,
    `copies` INTEGER NOT NULL DEFAULT 1,
    `reason` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `readyAt` DATETIME(3) NULL,
    `officeNote` TEXT NULL,
    `handledById` VARCHAR(30) NULL,
    `handledAt` DATETIME(3) NULL,
    `collectedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `document_requests_schoolId_status_idx`(`schoolId`, `status`),
    INDEX `document_requests_schoolId_idx`(`schoolId`),
    INDEX `document_requests_studentId_idx`(`studentId`),
    INDEX `document_requests_typeId_idx`(`typeId`),
    INDEX `document_requests_requestedById_idx`(`requestedById`),
    INDEX `document_requests_handledById_idx`(`handledById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `school_years` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PLANNED',
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `school_years_schoolId_idx`(`schoolId`),
    UNIQUE INDEX `school_years_schoolId_name_key`(`schoolId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `terms` (
    `id` VARCHAR(30) NOT NULL,
    `schoolYearId` VARCHAR(30) NOT NULL,
    `number` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `massarCode` VARCHAR(191) NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PLANNED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `terms_schoolYearId_idx`(`schoolYearId`),
    UNIQUE INDEX `terms_schoolYearId_number_key`(`schoolYearId`, `number`),
    UNIQUE INDEX `terms_schoolYearId_massarCode_key`(`schoolYearId`, `massarCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `school_settings` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(191) NOT NULL,
    `gradingMaxScore` INTEGER NOT NULL DEFAULT 20,
    `passMarkBps` INTEGER NOT NULL DEFAULT 5000,
    `teachingDays` VARCHAR(191) NOT NULL DEFAULT '1,2,3,4,5,6',
    `currencyCode` VARCHAR(191) NOT NULL DEFAULT 'MAD',
    `defaultLocale` VARCHAR(191) NOT NULL DEFAULT 'fr',
    `defaultAccent` VARCHAR(191) NOT NULL DEFAULT 'blue',
    `studentCodeFormat` VARCHAR(191) NOT NULL DEFAULT 'E-{year}-{seq:4}',
    `familyCodeFormat` VARCHAR(191) NOT NULL DEFAULT 'F-{year}-{seq:4}',
    `staffCodeFormat` VARCHAR(191) NOT NULL DEFAULT 'P-{year}-{seq:4}',
    `defaultInstalmentCount` INTEGER NOT NULL DEFAULT 0,
    `parentChatEnabled` BOOLEAN NOT NULL DEFAULT false,
    `parentClassChatEnabled` BOOLEAN NOT NULL DEFAULT false,
    `feeDueDayOfMonth` INTEGER NOT NULL DEFAULT 5,
    `periodMinutes` INTEGER NOT NULL DEFAULT 60,
    `dayStartsAt` VARCHAR(191) NOT NULL DEFAULT '08:00',
    `afternoonStartsAt` VARCHAR(191) NOT NULL DEFAULT '14:00',
    `periodsBeforeBreak` INTEGER NOT NULL DEFAULT 2,
    `breakMinutes` INTEGER NOT NULL DEFAULT 15,
    `morningPeriods` INTEGER NOT NULL DEFAULT 4,
    `afternoonPeriods` INTEGER NOT NULL DEFAULT 4,
    `payrollWorkingDays` INTEGER NOT NULL DEFAULT 26,
    `cnssRateBps` INTEGER NOT NULL DEFAULT 448,
    `cnssCeilingCentimes` INTEGER NOT NULL DEFAULT 600000,
    `amoRateBps` INTEGER NOT NULL DEFAULT 226,
    `irRateBps` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `school_settings_schoolId_key`(`schoolId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schools` (
    `id` VARCHAR(30) NOT NULL,
    `organizationId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `level` VARCHAR(191) NOT NULL DEFAULT 'GROUP',
    `massarCode` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `logoUrl` MEDIUMTEXT NULL,
    `addressLine` TEXT NULL,
    `city` VARCHAR(191) NULL,
    `region` VARCHAR(191) NULL,
    `postalCode` VARCHAR(191) NULL,
    `country` VARCHAR(191) NOT NULL DEFAULT 'MA',
    `directorName` VARCHAR(191) NULL,
    `capacity` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `schools_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `schools_organizationId_code_key`(`organizationId`, `code`),
    UNIQUE INDEX `schools_organizationId_massarCode_key`(`organizationId`, `massarCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `students` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `familyId` VARCHAR(30) NULL,
    `code` VARCHAR(191) NOT NULL,
    `massarCode` VARCHAR(191) NULL,
    `massarNumber` VARCHAR(191) NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `firstNameAr` VARCHAR(191) NULL,
    `lastNameAr` VARCHAR(191) NULL,
    `gender` VARCHAR(191) NOT NULL,
    `birthDate` DATETIME(3) NOT NULL,
    `birthCityId` VARCHAR(30) NULL,
    `neighbourhoodId` VARCHAR(30) NULL,
    `nationality` VARCHAR(191) NOT NULL DEFAULT 'MA',
    `nationalId` VARCHAR(191) NULL,
    `photoUrl` MEDIUMTEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PRE_REGISTERED',
    `entryDate` DATETIME(3) NULL,
    `exitDate` DATETIME(3) NULL,
    `bloodType` VARCHAR(191) NULL,
    `allergies` VARCHAR(191) NULL,
    `chronicCondition` VARCHAR(191) NULL,
    `medications` VARCHAR(191) NULL,
    `doctorName` VARCHAR(191) NULL,
    `doctorPhone` VARCHAR(191) NULL,
    `insurer` VARCHAR(191) NULL,
    `hasDisability` BOOLEAN NOT NULL DEFAULT false,
    `medicalNotes` TEXT NULL,
    `previousSchool` VARCHAR(191) NULL,
    `previousLevel` VARCHAR(191) NULL,
    `previousSchoolCityId` VARCHAR(30) NULL,
    `schoolingType` VARCHAR(191) NULL,
    `transferReason` TEXT NULL,
    `brotherCount` INTEGER NULL,
    `sisterCount` INTEGER NULL,
    `birthRank` INTEGER NULL,
    `livesWith` VARCHAR(191) NULL,
    `isOrphan` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `students_schoolId_idx`(`schoolId`),
    INDEX `students_familyId_idx`(`familyId`),
    INDEX `students_neighbourhoodId_idx`(`neighbourhoodId`),
    INDEX `students_birthCityId_idx`(`birthCityId`),
    INDEX `students_previousSchoolCityId_idx`(`previousSchoolCityId`),
    INDEX `students_schoolId_lastName_idx`(`schoolId`, `lastName`),
    INDEX `students_schoolId_status_idx`(`schoolId`, `status`),
    UNIQUE INDEX `students_schoolId_code_key`(`schoolId`, `code`),
    UNIQUE INDEX `students_schoolId_massarCode_key`(`schoolId`, `massarCode`),
    UNIQUE INDEX `students_schoolId_massarNumber_key`(`schoolId`, `massarNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supply_articles` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `category` VARCHAR(191) NOT NULL,
    `defaultQuantity` INTEGER NULL,
    `notes` TEXT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `supply_articles_schoolId_idx`(`schoolId`),
    INDEX `supply_articles_schoolId_category_idx`(`schoolId`, `category`),
    UNIQUE INDEX `supply_articles_schoolId_code_key`(`schoolId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supply_items` (
    `id` VARCHAR(30) NOT NULL,
    `listId` VARCHAR(30) NOT NULL,
    `articleId` VARCHAR(30) NULL,
    `label` VARCHAR(191) NOT NULL,
    `labelAr` VARCHAR(191) NULL,
    `quantity` INTEGER NULL,
    `notes` TEXT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `supply_items_listId_idx`(`listId`),
    INDEX `supply_items_articleId_idx`(`articleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supply_lists` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `schoolYearId` VARCHAR(30) NOT NULL,
    `schoolClassId` VARCHAR(30) NOT NULL,
    `subjectId` VARCHAR(30) NULL,
    `title` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `dueOn` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `authorId` VARCHAR(30) NULL,
    `reviewedById` VARCHAR(30) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewNote` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `supply_lists_schoolId_idx`(`schoolId`),
    INDEX `supply_lists_schoolYearId_idx`(`schoolYearId`),
    INDEX `supply_lists_schoolClassId_idx`(`schoolClassId`),
    INDEX `supply_lists_subjectId_idx`(`subjectId`),
    INDEX `supply_lists_authorId_idx`(`authorId`),
    INDEX `supply_lists_schoolYearId_status_idx`(`schoolYearId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `school_holidays` (
    `id` VARCHAR(30) NOT NULL,
    `schoolYearId` VARCHAR(30) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'SCHOOL_HOLIDAY',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `school_holidays_schoolYearId_idx`(`schoolYearId`),
    INDEX `school_holidays_schoolYearId_startDate_idx`(`schoolYearId`, `startDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `school_weeks` (
    `id` VARCHAR(30) NOT NULL,
    `schoolYearId` VARCHAR(30) NOT NULL,
    `number` INTEGER NOT NULL,
    `startsOn` DATETIME(3) NOT NULL,
    `endsOn` DATETIME(3) NOT NULL,
    `isTeaching` BOOLEAN NOT NULL DEFAULT true,
    `parity` VARCHAR(191) NOT NULL DEFAULT 'A',
    `label` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `school_weeks_schoolYearId_idx`(`schoolYearId`),
    INDEX `school_weeks_schoolYearId_startsOn_idx`(`schoolYearId`, `startsOn`),
    UNIQUE INDEX `school_weeks_schoolYearId_number_key`(`schoolYearId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teacher_absences` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `teacherId` VARCHAR(30) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'OTHER',
    `substituteId` VARCHAR(30) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `teacher_absences_schoolId_idx`(`schoolId`),
    INDEX `teacher_absences_teacherId_idx`(`teacherId`),
    INDEX `teacher_absences_schoolId_startDate_idx`(`schoolId`, `startDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teacher_unavailability` (
    `id` VARCHAR(30) NOT NULL,
    `teacherId` VARCHAR(30) NOT NULL,
    `timeSlotId` VARCHAR(30) NOT NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `teacher_unavailability_teacherId_idx`(`teacherId`),
    INDEX `teacher_unavailability_timeSlotId_idx`(`timeSlotId`),
    UNIQUE INDEX `teacher_unavailability_teacherId_timeSlotId_key`(`teacherId`, `timeSlotId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `time_slots` (
    `id` VARCHAR(30) NOT NULL,
    `schoolYearId` VARCHAR(30) NOT NULL,
    `dayOfWeek` INTEGER NOT NULL,
    `session` VARCHAR(191) NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `scheduleKind` VARCHAR(191) NOT NULL DEFAULT 'STANDARD',
    `position` INTEGER NOT NULL DEFAULT 0,
    `isBreak` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `time_slots_schoolYearId_idx`(`schoolYearId`),
    UNIQUE INDEX `time_slots_schoolYearId_scheduleKind_dayOfWeek_startTime_key`(`schoolYearId`, `scheduleKind`, `dayOfWeek`, `startTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `timetable_entries` (
    `id` VARCHAR(30) NOT NULL,
    `schoolClassId` VARCHAR(30) NOT NULL,
    `classGroupId` VARCHAR(30) NULL,
    `timeSlotId` VARCHAR(30) NOT NULL,
    `subjectId` VARCHAR(30) NOT NULL,
    `teacherId` VARCHAR(30) NULL,
    `roomId` VARCHAR(30) NULL,
    `termId` VARCHAR(30) NULL,
    `weekParity` VARCHAR(191) NOT NULL DEFAULT 'ALL',
    `fromWeek` INTEGER NULL,
    `toWeek` INTEGER NULL,
    `bookingKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `timetable_entries_schoolClassId_idx`(`schoolClassId`),
    INDEX `timetable_entries_classGroupId_idx`(`classGroupId`),
    INDEX `timetable_entries_timeSlotId_idx`(`timeSlotId`),
    INDEX `timetable_entries_subjectId_idx`(`subjectId`),
    INDEX `timetable_entries_teacherId_idx`(`teacherId`),
    INDEX `timetable_entries_roomId_idx`(`roomId`),
    INDEX `timetable_entries_termId_idx`(`termId`),
    INDEX `timetable_entries_schoolClassId_fromWeek_idx`(`schoolClassId`, `fromWeek`),
    UNIQUE INDEX `timetable_entries_schoolClassId_timeSlotId_bookingKey_key`(`schoolClassId`, `timeSlotId`, `bookingKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `timetable_exceptions` (
    `id` VARCHAR(30) NOT NULL,
    `schoolClassId` VARCHAR(30) NOT NULL,
    `classGroupId` VARCHAR(30) NULL,
    `timeSlotId` VARCHAR(30) NOT NULL,
    `weekStart` DATETIME(3) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(30) NULL,
    `teacherId` VARCHAR(30) NULL,
    `roomId` VARCHAR(30) NULL,
    `note` TEXT NULL,
    `createdById` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `scopeKey` VARCHAR(191) NOT NULL,

    INDEX `timetable_exceptions_schoolClassId_idx`(`schoolClassId`),
    INDEX `timetable_exceptions_classGroupId_idx`(`classGroupId`),
    INDEX `timetable_exceptions_timeSlotId_idx`(`timeSlotId`),
    INDEX `timetable_exceptions_teacherId_idx`(`teacherId`),
    INDEX `timetable_exceptions_roomId_idx`(`roomId`),
    INDEX `timetable_exceptions_subjectId_idx`(`subjectId`),
    INDEX `timetable_exceptions_schoolClassId_weekStart_idx`(`schoolClassId`, `weekStart`),
    UNIQUE INDEX `timetable_exceptions_schoolClassId_timeSlotId_weekStart_scop_key`(`schoolClassId`, `timeSlotId`, `weekStart`, `scopeKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fuel_requests` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `vehicleId` VARCHAR(30) NOT NULL,
    `requestedById` VARCHAR(30) NULL,
    `requestedByName` VARCHAR(191) NULL,
    `occurredOn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `litresTenths` INTEGER NOT NULL DEFAULT 0,
    `odometerKm` INTEGER NULL,
    `amountCentimes` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `decidedById` VARCHAR(30) NULL,
    `decidedAt` DATETIME(3) NULL,
    `cashOperationId` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `fuel_requests_cashOperationId_key`(`cashOperationId`),
    INDEX `fuel_requests_schoolId_idx`(`schoolId`),
    INDEX `fuel_requests_vehicleId_idx`(`vehicleId`),
    INDEX `fuel_requests_requestedById_idx`(`requestedById`),
    INDEX `fuel_requests_decidedById_idx`(`decidedById`),
    INDEX `fuel_requests_schoolId_status_idx`(`schoolId`, `status`),
    INDEX `fuel_requests_vehicleId_occurredOn_idx`(`vehicleId`, `occurredOn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `route_neighbourhoods` (
    `id` VARCHAR(30) NOT NULL,
    `routeId` VARCHAR(30) NOT NULL,
    `neighbourhoodId` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `route_neighbourhoods_routeId_idx`(`routeId`),
    INDEX `route_neighbourhoods_neighbourhoodId_idx`(`neighbourhoodId`),
    UNIQUE INDEX `route_neighbourhoods_routeId_neighbourhoodId_key`(`routeId`, `neighbourhoodId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `route_schedules` (
    `id` VARCHAR(30) NOT NULL,
    `routeId` VARCHAR(30) NOT NULL,
    `scheduleId` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `route_schedules_routeId_idx`(`routeId`),
    INDEX `route_schedules_scheduleId_idx`(`scheduleId`),
    UNIQUE INDEX `route_schedules_routeId_scheduleId_key`(`routeId`, `scheduleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `route_stops` (
    `id` VARCHAR(30) NOT NULL,
    `routeId` VARCHAR(30) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `landmark` VARCHAR(191) NULL,
    `neighbourhoodId` VARCHAR(30) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `pickupTime` VARCHAR(191) NULL,
    `dropoffTime` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `route_stops_routeId_idx`(`routeId`),
    INDEX `route_stops_neighbourhoodId_idx`(`neighbourhoodId`),
    UNIQUE INDEX `route_stops_routeId_name_key`(`routeId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transport_attendance` (
    `id` VARCHAR(30) NOT NULL,
    `subscriptionId` VARCHAR(30) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `scheduleId` VARCHAR(30) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PRESENT',
    `minutesLate` INTEGER NULL,
    `reason` TEXT NULL,
    `isJustified` BOOLEAN NOT NULL DEFAULT false,
    `recordedById` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `scopeKey` VARCHAR(191) NOT NULL,

    INDEX `transport_attendance_subscriptionId_idx`(`subscriptionId`),
    INDEX `transport_attendance_scheduleId_idx`(`scheduleId`),
    INDEX `transport_attendance_recordedById_idx`(`recordedById`),
    INDEX `transport_attendance_date_idx`(`date`),
    UNIQUE INDEX `transport_attendance_subscriptionId_date_scopeKey_key`(`subscriptionId`, `date`, `scopeKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transport_routes` (
    `id` VARCHAR(30) NOT NULL,
    `schoolYearId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `direction` VARCHAR(191) NOT NULL DEFAULT 'BOTH',
    `vehicleId` VARCHAR(30) NULL,
    `capacity` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `transport_routes_schoolYearId_idx`(`schoolYearId`),
    INDEX `transport_routes_vehicleId_idx`(`vehicleId`),
    UNIQUE INDEX `transport_routes_schoolYearId_code_key`(`schoolYearId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transport_schedules` (
    `id` VARCHAR(30) NOT NULL,
    `schoolYearId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `direction` VARCHAR(191) NOT NULL DEFAULT 'MORNING',
    `departureTime` VARCHAR(191) NOT NULL,
    `arrivalTime` VARCHAR(191) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `transport_schedules_schoolYearId_idx`(`schoolYearId`),
    UNIQUE INDEX `transport_schedules_schoolYearId_code_key`(`schoolYearId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transport_subscriptions` (
    `id` VARCHAR(30) NOT NULL,
    `enrollmentId` VARCHAR(30) NOT NULL,
    `routeId` VARCHAR(30) NOT NULL,
    `stopId` VARCHAR(30) NOT NULL,
    `direction` VARCHAR(191) NOT NULL DEFAULT 'BOTH',
    `scheduleId` VARCHAR(30) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `startsOn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endsOn` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `scopeKey` VARCHAR(191) NOT NULL,

    INDEX `transport_subscriptions_enrollmentId_idx`(`enrollmentId`),
    INDEX `transport_subscriptions_routeId_idx`(`routeId`),
    INDEX `transport_subscriptions_stopId_idx`(`stopId`),
    INDEX `transport_subscriptions_scheduleId_idx`(`scheduleId`),
    INDEX `transport_subscriptions_routeId_status_idx`(`routeId`, `status`),
    UNIQUE INDEX `transport_subscriptions_enrollmentId_scopeKey_key`(`enrollmentId`, `scopeKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trip_runs` (
    `id` VARCHAR(30) NOT NULL,
    `routeId` VARCHAR(30) NOT NULL,
    `scheduleId` VARCHAR(30) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PLANNED',
    `plannedDepartureTime` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NULL,
    `startedById` VARCHAR(30) NULL,
    `arrivedAt` DATETIME(3) NULL,
    `arrivedById` VARCHAR(30) NULL,
    `vehicleId` VARCHAR(30) NULL,
    `cancelReason` TEXT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `trip_runs_routeId_idx`(`routeId`),
    INDEX `trip_runs_scheduleId_idx`(`scheduleId`),
    INDEX `trip_runs_vehicleId_idx`(`vehicleId`),
    INDEX `trip_runs_date_status_idx`(`date`, `status`),
    INDEX `trip_runs_startedById_idx`(`startedById`),
    INDEX `trip_runs_arrivedById_idx`(`arrivedById`),
    UNIQUE INDEX `trip_runs_routeId_scheduleId_date_key`(`routeId`, `scheduleId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vehicles` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `registration` VARCHAR(191) NOT NULL,
    `make` VARCHAR(191) NULL,
    `model` VARCHAR(191) NULL,
    `modelYear` INTEGER NULL,
    `seatCount` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `insuranceExpiresOn` DATETIME(3) NULL,
    `inspectionExpiresOn` DATETIME(3) NULL,
    `driverId` VARCHAR(30) NULL,
    `driverName` VARCHAR(191) NULL,
    `driverPhone` VARCHAR(191) NULL,
    `attendantId` VARCHAR(30) NULL,
    `attendantName` VARCHAR(191) NULL,
    `attendantPhone` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `vehicles_schoolId_idx`(`schoolId`),
    INDEX `vehicles_driverId_idx`(`driverId`),
    INDEX `vehicles_attendantId_idx`(`attendantId`),
    INDEX `vehicles_schoolId_status_idx`(`schoolId`, `status`),
    UNIQUE INDEX `vehicles_schoolId_registration_key`(`schoolId`, `registration`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `banks` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `agency` VARCHAR(191) NULL,
    `accountNumber` VARCHAR(191) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `banks_schoolId_idx`(`schoolId`),
    UNIQUE INDEX `banks_schoolId_code_key`(`schoolId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cash_operations` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `cashSessionId` VARCHAR(30) NULL,
    `kind` VARCHAR(191) NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `amountCentimes` INTEGER NOT NULL,
    `cashImpactCentimes` INTEGER NOT NULL DEFAULT 0,
    `label` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(191) NOT NULL DEFAULT 'POSTED',
    `reversesOperationId` VARCHAR(191) NULL,
    `paymentId` VARCHAR(191) NULL,
    `categoryId` VARCHAR(30) NULL,
    `subcategoryId` VARCHAR(30) NULL,
    `motifId` VARCHAR(30) NULL,
    `beneficiaryStaffId` VARCHAR(30) NULL,
    `beneficiaryName` VARCHAR(191) NULL,
    `supplierId` VARCHAR(30) NULL,
    `transferGroupId` VARCHAR(191) NULL,
    `counterpartRegisterId` VARCHAR(30) NULL,
    `bankId` VARCHAR(30) NULL,
    `bankAccountLabel` VARCHAR(191) NULL,
    `chequeId` VARCHAR(30) NULL,
    `createdById` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cash_operations_reversesOperationId_key`(`reversesOperationId`),
    UNIQUE INDEX `cash_operations_paymentId_key`(`paymentId`),
    INDEX `cash_operations_schoolId_idx`(`schoolId`),
    INDEX `cash_operations_beneficiaryStaffId_idx`(`beneficiaryStaffId`),
    INDEX `cash_operations_supplierId_idx`(`supplierId`),
    INDEX `cash_operations_cashSessionId_idx`(`cashSessionId`),
    INDEX `cash_operations_categoryId_idx`(`categoryId`),
    INDEX `cash_operations_subcategoryId_idx`(`subcategoryId`),
    INDEX `cash_operations_motifId_idx`(`motifId`),
    INDEX `cash_operations_bankId_idx`(`bankId`),
    INDEX `cash_operations_counterpartRegisterId_idx`(`counterpartRegisterId`),
    INDEX `cash_operations_chequeId_idx`(`chequeId`),
    INDEX `cash_operations_createdById_idx`(`createdById`),
    INDEX `cash_operations_transferGroupId_idx`(`transferGroupId`),
    INDEX `cash_operations_schoolId_occurredAt_idx`(`schoolId`, `occurredAt`),
    INDEX `cash_operations_schoolId_kind_status_idx`(`schoolId`, `kind`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cash_registers` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `holderId` VARCHAR(191) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cash_registers_holderId_key`(`holderId`),
    INDEX `cash_registers_schoolId_idx`(`schoolId`),
    UNIQUE INDEX `cash_registers_schoolId_code_key`(`schoolId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cash_sessions` (
    `id` VARCHAR(30) NOT NULL,
    `cashRegisterId` VARCHAR(30) NOT NULL,
    `openedById` VARCHAR(30) NOT NULL,
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `openingFloatCentimes` INTEGER NOT NULL DEFAULT 0,
    `closedById` VARCHAR(30) NULL,
    `closedAt` DATETIME(3) NULL,
    `countedCentimes` INTEGER NULL,
    `expectedCentimes` INTEGER NULL,
    `varianceCentimes` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `wasAutoClosed` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `openKey` VARCHAR(191) NULL,

    UNIQUE INDEX `cash_sessions_openKey_key`(`openKey`),
    INDEX `cash_sessions_cashRegisterId_idx`(`cashRegisterId`),
    INDEX `cash_sessions_status_idx`(`status`),
    INDEX `cash_sessions_openedAt_idx`(`openedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cheques` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `direction` VARCHAR(191) NOT NULL DEFAULT 'INCOMING',
    `number` VARCHAR(191) NOT NULL,
    `bankId` VARCHAR(30) NULL,
    `bankName` VARCHAR(191) NULL,
    `drawerName` VARCHAR(191) NULL,
    `amountCentimes` INTEGER NOT NULL,
    `issuedOn` DATETIME(3) NULL,
    `dueOn` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `depositedOn` DATETIME(3) NULL,
    `settledOn` DATETIME(3) NULL,
    `bounceReason` TEXT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `cheques_schoolId_idx`(`schoolId`),
    INDEX `cheques_bankId_idx`(`bankId`),
    INDEX `cheques_schoolId_status_idx`(`schoolId`, `status`),
    INDEX `cheques_schoolId_number_idx`(`schoolId`, `number`),
    INDEX `cheques_dueOn_idx`(`dueOn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `operation_categories` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'OUT',
    `position` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `operation_categories_schoolId_idx`(`schoolId`),
    INDEX `operation_categories_schoolId_kind_idx`(`schoolId`, `kind`),
    UNIQUE INDEX `operation_categories_schoolId_code_key`(`schoolId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `operation_motifs` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `categoryId` VARCHAR(30) NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `operation_motifs_schoolId_idx`(`schoolId`),
    INDEX `operation_motifs_categoryId_idx`(`categoryId`),
    UNIQUE INDEX `operation_motifs_schoolId_code_key`(`schoolId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `operation_subcategories` (
    `id` VARCHAR(30) NOT NULL,
    `categoryId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `operation_subcategories_categoryId_idx`(`categoryId`),
    UNIQUE INDEX `operation_subcategories_categoryId_code_key`(`categoryId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_allocations` (
    `id` VARCHAR(30) NOT NULL,
    `paymentId` VARCHAR(30) NOT NULL,
    `enrollmentFeeId` VARCHAR(30) NOT NULL,
    `amountCentimes` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payment_allocations_enrollmentFeeId_idx`(`enrollmentFeeId`),
    UNIQUE INDEX `payment_allocations_paymentId_enrollmentFeeId_key`(`paymentId`, `enrollmentFeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_tenders` (
    `id` VARCHAR(30) NOT NULL,
    `paymentId` VARCHAR(30) NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `amountCentimes` INTEGER NOT NULL,
    `reference` VARCHAR(191) NULL,
    `bankId` VARCHAR(30) NULL,
    `bankName` VARCHAR(191) NULL,
    `chequeId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payment_tenders_chequeId_key`(`chequeId`),
    INDEX `payment_tenders_paymentId_idx`(`paymentId`),
    INDEX `payment_tenders_bankId_idx`(`bankId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `schoolYearId` VARCHAR(30) NOT NULL,
    `familyId` VARCHAR(30) NULL,
    `code` VARCHAR(191) NOT NULL,
    `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `totalCentimes` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'POSTED',
    `cancelledAt` DATETIME(3) NULL,
    `cancelReason` TEXT NULL,
    `cancelledById` VARCHAR(30) NULL,
    `cashSessionId` VARCHAR(30) NULL,
    `createdById` VARCHAR(30) NOT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payments_schoolId_idx`(`schoolId`),
    INDEX `payments_schoolYearId_idx`(`schoolYearId`),
    INDEX `payments_familyId_idx`(`familyId`),
    INDEX `payments_cashSessionId_idx`(`cashSessionId`),
    INDEX `payments_schoolId_paidAt_idx`(`schoolId`, `paidAt`),
    INDEX `payments_schoolId_status_idx`(`schoolId`, `status`),
    INDEX `payments_cancelledById_idx`(`cancelledById`),
    UNIQUE INDEX `payments_schoolId_code_key`(`schoolId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `suppliers` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'VENDOR',
    `defaultCategoryId` VARCHAR(30) NULL,
    `defaultSubcategoryId` VARCHAR(30) NULL,
    `accountRef` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `suppliers_schoolId_idx`(`schoolId`),
    INDEX `suppliers_schoolId_kind_isActive_idx`(`schoolId`, `kind`, `isActive`),
    UNIQUE INDEX `suppliers_schoolId_code_key`(`schoolId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `profiles` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `avatarUrl` MEDIUMTEXT NULL,
    `bio` VARCHAR(191) NULL,
    `jobFunctionId` VARCHAR(30) NULL,
    `birthDate` DATETIME(3) NULL,
    `locale` VARCHAR(191) NOT NULL DEFAULT 'fr',
    `themeMode` VARCHAR(191) NOT NULL DEFAULT 'system',
    `accent` VARCHAR(191) NOT NULL DEFAULT 'blue',
    `fontFamily` VARCHAR(191) NOT NULL DEFAULT 'geist',
    `fontSize` VARCHAR(191) NOT NULL DEFAULT 'md',
    `radius` VARCHAR(191) NOT NULL DEFAULT 'md',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `profiles_userId_key`(`userId`),
    INDEX `profiles_jobFunctionId_idx`(`jobFunctionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff_functions` (
    `id` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `staff_functions_schoolId_idx`(`schoolId`),
    UNIQUE INDEX `staff_functions_schoolId_code_key`(`schoolId`, `code`),
    UNIQUE INDEX `staff_functions_schoolId_name_key`(`schoolId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(30) NOT NULL,
    `organizationId` VARCHAR(30) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isSuperAdmin` BOOLEAN NOT NULL DEFAULT false,
    `orgRoleId` VARCHAR(30) NULL,
    `currentSchoolId` VARCHAR(30) NULL,
    `currentSchoolYearId` VARCHAR(30) NULL,
    `credentialsChangedAt` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_username_key`(`username`),
    INDEX `users_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `education_levels` ADD CONSTRAINT `education_levels_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `level_subjects` ADD CONSTRAINT `level_subjects_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `levels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `level_subjects` ADD CONSTRAINT `level_subjects_trackId_fkey` FOREIGN KEY (`trackId`) REFERENCES `tracks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `level_subjects` ADD CONSTRAINT `level_subjects_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `levels` ADD CONSTRAINT `levels_educationLevelId_fkey` FOREIGN KEY (`educationLevelId`) REFERENCES `education_levels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `levels` ADD CONSTRAINT `levels_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subjects` ADD CONSTRAINT `subjects_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subjects` ADD CONSTRAINT `subjects_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tracks` ADD CONSTRAINT `tracks_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `levels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roles` ADD CONSTRAINT `roles_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appreciation_bands` ADD CONSTRAINT `appreciation_bands_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessment_grades` ADD CONSTRAINT `assessment_grades_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `assessments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessment_grades` ADD CONSTRAINT `assessment_grades_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `enrollments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessment_grades` ADD CONSTRAINT `assessment_grades_gradedById_fkey` FOREIGN KEY (`gradedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessment_questions` ADD CONSTRAINT `assessment_questions_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `assessments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessment_types` ADD CONSTRAINT `assessment_types_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_schoolClassId_fkey` FOREIGN KEY (`schoolClassId`) REFERENCES `classes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_classGroupId_fkey` FOREIGN KEY (`classGroupId`) REFERENCES `class_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_termId_fkey` FOREIGN KEY (`termId`) REFERENCES `terms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_assessmentTypeId_fkey` FOREIGN KEY (`assessmentTypeId`) REFERENCES `assessment_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `discounts` ADD CONSTRAINT `discounts_schoolYearId_fkey` FOREIGN KEY (`schoolYearId`) REFERENCES `school_years`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `discounts` ADD CONSTRAINT `discounts_feeTypeId_fkey` FOREIGN KEY (`feeTypeId`) REFERENCES `fee_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_rates` ADD CONSTRAINT `fee_rates_schoolYearId_fkey` FOREIGN KEY (`schoolYearId`) REFERENCES `school_years`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_rates` ADD CONSTRAINT `fee_rates_feeTypeId_fkey` FOREIGN KEY (`feeTypeId`) REFERENCES `fee_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_rates` ADD CONSTRAINT `fee_rates_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `levels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_types` ADD CONSTRAINT `fee_types_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulletin_lines` ADD CONSTRAINT `bulletin_lines_bulletinId_fkey` FOREIGN KEY (`bulletinId`) REFERENCES `bulletins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulletin_lines` ADD CONSTRAINT `bulletin_lines_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulletin_lines` ADD CONSTRAINT `bulletin_lines_parentSubjectId_fkey` FOREIGN KEY (`parentSubjectId`) REFERENCES `subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulletins` ADD CONSTRAINT `bulletins_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulletins` ADD CONSTRAINT `bulletins_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `enrollments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulletins` ADD CONSTRAINT `bulletins_termId_fkey` FOREIGN KEY (`termId`) REFERENCES `terms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulletins` ADD CONSTRAINT `bulletins_schoolClassId_fkey` FOREIGN KEY (`schoolClassId`) REFERENCES `classes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulletins` ADD CONSTRAINT `bulletins_publishedById_fkey` FOREIGN KEY (`publishedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_channels` ADD CONSTRAINT `chat_channels_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_channels` ADD CONSTRAINT `chat_channels_schoolYearId_fkey` FOREIGN KEY (`schoolYearId`) REFERENCES `school_years`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_channels` ADD CONSTRAINT `chat_channels_schoolClassId_fkey` FOREIGN KEY (`schoolClassId`) REFERENCES `classes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `chat_channels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_deletedById_fkey` FOREIGN KEY (`deletedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_groups` ADD CONSTRAINT `class_groups_schoolClassId_fkey` FOREIGN KEY (`schoolClassId`) REFERENCES `classes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_groups` ADD CONSTRAINT `class_groups_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `level_offerings` ADD CONSTRAINT `level_offerings_schoolYearId_fkey` FOREIGN KEY (`schoolYearId`) REFERENCES `school_years`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `level_offerings` ADD CONSTRAINT `level_offerings_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `levels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `level_offerings` ADD CONSTRAINT `level_offerings_trackId_fkey` FOREIGN KEY (`trackId`) REFERENCES `tracks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `classes` ADD CONSTRAINT `classes_levelOfferingId_fkey` FOREIGN KEY (`levelOfferingId`) REFERENCES `level_offerings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `classes` ADD CONSTRAINT `classes_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `classes` ADD CONSTRAINT `classes_mainTeacherId_fkey` FOREIGN KEY (`mainTeacherId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `classes` ADD CONSTRAINT `classes_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teaching_assignments` ADD CONSTRAINT `teaching_assignments_schoolClassId_fkey` FOREIGN KEY (`schoolClassId`) REFERENCES `classes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teaching_assignments` ADD CONSTRAINT `teaching_assignments_classGroupId_fkey` FOREIGN KEY (`classGroupId`) REFERENCES `class_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teaching_assignments` ADD CONSTRAINT `teaching_assignments_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teaching_assignments` ADD CONSTRAINT `teaching_assignments_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_attendance` ADD CONSTRAINT `student_attendance_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `enrollments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_attendance` ADD CONSTRAINT `student_attendance_timeSlotId_fkey` FOREIGN KEY (`timeSlotId`) REFERENCES `time_slots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_attendance` ADD CONSTRAINT `student_attendance_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_attendance` ADD CONSTRAINT `student_attendance_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_remarks` ADD CONSTRAINT `student_remarks_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `enrollments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_remarks` ADD CONSTRAINT `student_remarks_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_remarks` ADD CONSTRAINT `student_remarks_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_types` ADD CONSTRAINT `document_types_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_documents` ADD CONSTRAINT `student_documents_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_documents` ADD CONSTRAINT `student_documents_documentTypeId_fkey` FOREIGN KEY (`documentTypeId`) REFERENCES `document_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_documents` ADD CONSTRAINT `student_documents_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment_fees` ADD CONSTRAINT `enrollment_fees_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `enrollments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment_fees` ADD CONSTRAINT `enrollment_fees_feeTypeId_fkey` FOREIGN KEY (`feeTypeId`) REFERENCES `fee_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment_fees` ADD CONSTRAINT `enrollment_fees_feeRateId_fkey` FOREIGN KEY (`feeRateId`) REFERENCES `fee_rates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment_fees` ADD CONSTRAINT `enrollment_fees_discountId_fkey` FOREIGN KEY (`discountId`) REFERENCES `discounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment_fees` ADD CONSTRAINT `enrollment_fees_cancelledById_fkey` FOREIGN KEY (`cancelledById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment_options` ADD CONSTRAINT `enrollment_options_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `enrollments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment_options` ADD CONSTRAINT `enrollment_options_feeTypeId_fkey` FOREIGN KEY (`feeTypeId`) REFERENCES `fee_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_schoolYearId_fkey` FOREIGN KEY (`schoolYearId`) REFERENCES `school_years`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_levelOfferingId_fkey` FOREIGN KEY (`levelOfferingId`) REFERENCES `level_offerings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_schoolClassId_fkey` FOREIGN KEY (`schoolClassId`) REFERENCES `classes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_classGroupId_fkey` FOREIGN KEY (`classGroupId`) REFERENCES `class_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `events_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `events_schoolYearId_fkey` FOREIGN KEY (`schoolYearId`) REFERENCES `school_years`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `events_publishedById_fkey` FOREIGN KEY (`publishedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `events_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_audiences` ADD CONSTRAINT `event_audiences_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_audiences` ADD CONSTRAINT `event_audiences_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `levels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_audiences` ADD CONSTRAINT `event_audiences_schoolClassId_fkey` FOREIGN KEY (`schoolClassId`) REFERENCES `classes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rooms` ADD CONSTRAINT `rooms_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `families` ADD CONSTRAINT `families_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `guardians` ADD CONSTRAINT `guardians_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `guardians` ADD CONSTRAINT `guardians_parentJobId_fkey` FOREIGN KEY (`parentJobId`) REFERENCES `parent_jobs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `guardians` ADD CONSTRAINT `guardians_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parent_jobs` ADD CONSTRAINT `parent_jobs_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cities` ADD CONSTRAINT `cities_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `neighbourhoods` ADD CONSTRAINT `neighbourhoods_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `neighbourhoods` ADD CONSTRAINT `neighbourhoods_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `cities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employment_contracts` ADD CONSTRAINT `employment_contracts_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_decidedById_fkey` FOREIGN KEY (`decidedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salary_advances` ADD CONSTRAINT `salary_advances_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salary_advances` ADD CONSTRAINT `salary_advances_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salary_advances` ADD CONSTRAINT `salary_advances_cashOperationId_fkey` FOREIGN KEY (`cashOperationId`) REFERENCES `cash_operations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salary_advance_recoveries` ADD CONSTRAINT `salary_advance_recoveries_advanceId_fkey` FOREIGN KEY (`advanceId`) REFERENCES `salary_advances`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salary_advance_recoveries` ADD CONSTRAINT `salary_advance_recoveries_salaryPaymentId_fkey` FOREIGN KEY (`salaryPaymentId`) REFERENCES `salary_payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salary_payments` ADD CONSTRAINT `salary_payments_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salary_payments` ADD CONSTRAINT `salary_payments_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `employment_contracts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salary_payments` ADD CONSTRAINT `salary_payments_cashOperationId_fkey` FOREIGN KEY (`cashOperationId`) REFERENCES `cash_operations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_attendance` ADD CONSTRAINT `staff_attendance_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_attendance` ADD CONSTRAINT `staff_attendance_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff` ADD CONSTRAINT `staff_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff` ADD CONSTRAINT `staff_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_subject_levels` ADD CONSTRAINT `teacher_subject_levels_teacherSubjectId_fkey` FOREIGN KEY (`teacherSubjectId`) REFERENCES `teacher_subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_subject_levels` ADD CONSTRAINT `teacher_subject_levels_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `levels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_subjects` ADD CONSTRAINT `teacher_subjects_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_subjects` ADD CONSTRAINT `teacher_subjects_schoolYearId_fkey` FOREIGN KEY (`schoolYearId`) REFERENCES `school_years`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_subjects` ADD CONSTRAINT `teacher_subjects_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_subjects` ADD CONSTRAINT `teacher_subjects_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_subjects` ADD CONSTRAINT `teacher_subjects_educationLevelId_fkey` FOREIGN KEY (`educationLevelId`) REFERENCES `education_levels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `portal_seen` ADD CONSTRAINT `portal_seen_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `report_favourites` ADD CONSTRAINT `report_favourites_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_request_types` ADD CONSTRAINT `document_request_types_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_requests` ADD CONSTRAINT `document_requests_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_requests` ADD CONSTRAINT `document_requests_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_requests` ADD CONSTRAINT `document_requests_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_requests` ADD CONSTRAINT `document_requests_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `document_request_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_requests` ADD CONSTRAINT `document_requests_handledById_fkey` FOREIGN KEY (`handledById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `school_years` ADD CONSTRAINT `school_years_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `terms` ADD CONSTRAINT `terms_schoolYearId_fkey` FOREIGN KEY (`schoolYearId`) REFERENCES `school_years`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `school_settings` ADD CONSTRAINT `school_settings_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schools` ADD CONSTRAINT `schools_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_birthCityId_fkey` FOREIGN KEY (`birthCityId`) REFERENCES `cities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_neighbourhoodId_fkey` FOREIGN KEY (`neighbourhoodId`) REFERENCES `neighbourhoods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_previousSchoolCityId_fkey` FOREIGN KEY (`previousSchoolCityId`) REFERENCES `cities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supply_articles` ADD CONSTRAINT `supply_articles_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supply_items` ADD CONSTRAINT `supply_items_listId_fkey` FOREIGN KEY (`listId`) REFERENCES `supply_lists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supply_items` ADD CONSTRAINT `supply_items_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `supply_articles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supply_lists` ADD CONSTRAINT `supply_lists_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supply_lists` ADD CONSTRAINT `supply_lists_schoolYearId_fkey` FOREIGN KEY (`schoolYearId`) REFERENCES `school_years`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supply_lists` ADD CONSTRAINT `supply_lists_schoolClassId_fkey` FOREIGN KEY (`schoolClassId`) REFERENCES `classes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supply_lists` ADD CONSTRAINT `supply_lists_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supply_lists` ADD CONSTRAINT `supply_lists_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supply_lists` ADD CONSTRAINT `supply_lists_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `school_holidays` ADD CONSTRAINT `school_holidays_schoolYearId_fkey` FOREIGN KEY (`schoolYearId`) REFERENCES `school_years`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `school_weeks` ADD CONSTRAINT `school_weeks_schoolYearId_fkey` FOREIGN KEY (`schoolYearId`) REFERENCES `school_years`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_absences` ADD CONSTRAINT `teacher_absences_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_absences` ADD CONSTRAINT `teacher_absences_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_absences` ADD CONSTRAINT `teacher_absences_substituteId_fkey` FOREIGN KEY (`substituteId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_unavailability` ADD CONSTRAINT `teacher_unavailability_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_unavailability` ADD CONSTRAINT `teacher_unavailability_timeSlotId_fkey` FOREIGN KEY (`timeSlotId`) REFERENCES `time_slots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `time_slots` ADD CONSTRAINT `time_slots_schoolYearId_fkey` FOREIGN KEY (`schoolYearId`) REFERENCES `school_years`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_entries` ADD CONSTRAINT `timetable_entries_schoolClassId_fkey` FOREIGN KEY (`schoolClassId`) REFERENCES `classes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_entries` ADD CONSTRAINT `timetable_entries_classGroupId_fkey` FOREIGN KEY (`classGroupId`) REFERENCES `class_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_entries` ADD CONSTRAINT `timetable_entries_timeSlotId_fkey` FOREIGN KEY (`timeSlotId`) REFERENCES `time_slots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_entries` ADD CONSTRAINT `timetable_entries_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_entries` ADD CONSTRAINT `timetable_entries_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_entries` ADD CONSTRAINT `timetable_entries_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_entries` ADD CONSTRAINT `timetable_entries_termId_fkey` FOREIGN KEY (`termId`) REFERENCES `terms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_exceptions` ADD CONSTRAINT `timetable_exceptions_schoolClassId_fkey` FOREIGN KEY (`schoolClassId`) REFERENCES `classes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_exceptions` ADD CONSTRAINT `timetable_exceptions_classGroupId_fkey` FOREIGN KEY (`classGroupId`) REFERENCES `class_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_exceptions` ADD CONSTRAINT `timetable_exceptions_timeSlotId_fkey` FOREIGN KEY (`timeSlotId`) REFERENCES `time_slots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_exceptions` ADD CONSTRAINT `timetable_exceptions_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_exceptions` ADD CONSTRAINT `timetable_exceptions_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_exceptions` ADD CONSTRAINT `timetable_exceptions_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_exceptions` ADD CONSTRAINT `timetable_exceptions_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fuel_requests` ADD CONSTRAINT `fuel_requests_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fuel_requests` ADD CONSTRAINT `fuel_requests_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `vehicles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fuel_requests` ADD CONSTRAINT `fuel_requests_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fuel_requests` ADD CONSTRAINT `fuel_requests_decidedById_fkey` FOREIGN KEY (`decidedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fuel_requests` ADD CONSTRAINT `fuel_requests_cashOperationId_fkey` FOREIGN KEY (`cashOperationId`) REFERENCES `cash_operations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `route_neighbourhoods` ADD CONSTRAINT `route_neighbourhoods_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `transport_routes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `route_neighbourhoods` ADD CONSTRAINT `route_neighbourhoods_neighbourhoodId_fkey` FOREIGN KEY (`neighbourhoodId`) REFERENCES `neighbourhoods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `route_schedules` ADD CONSTRAINT `route_schedules_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `transport_routes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `route_schedules` ADD CONSTRAINT `route_schedules_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `transport_schedules`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `route_stops` ADD CONSTRAINT `route_stops_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `transport_routes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `route_stops` ADD CONSTRAINT `route_stops_neighbourhoodId_fkey` FOREIGN KEY (`neighbourhoodId`) REFERENCES `neighbourhoods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transport_attendance` ADD CONSTRAINT `transport_attendance_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `transport_subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transport_attendance` ADD CONSTRAINT `transport_attendance_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `transport_schedules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transport_attendance` ADD CONSTRAINT `transport_attendance_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transport_routes` ADD CONSTRAINT `transport_routes_schoolYearId_fkey` FOREIGN KEY (`schoolYearId`) REFERENCES `school_years`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transport_routes` ADD CONSTRAINT `transport_routes_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `vehicles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transport_schedules` ADD CONSTRAINT `transport_schedules_schoolYearId_fkey` FOREIGN KEY (`schoolYearId`) REFERENCES `school_years`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transport_subscriptions` ADD CONSTRAINT `transport_subscriptions_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `enrollments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transport_subscriptions` ADD CONSTRAINT `transport_subscriptions_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `transport_routes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transport_subscriptions` ADD CONSTRAINT `transport_subscriptions_stopId_fkey` FOREIGN KEY (`stopId`) REFERENCES `route_stops`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transport_subscriptions` ADD CONSTRAINT `transport_subscriptions_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `transport_schedules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_runs` ADD CONSTRAINT `trip_runs_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `transport_routes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_runs` ADD CONSTRAINT `trip_runs_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `transport_schedules`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_runs` ADD CONSTRAINT `trip_runs_startedById_fkey` FOREIGN KEY (`startedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_runs` ADD CONSTRAINT `trip_runs_arrivedById_fkey` FOREIGN KEY (`arrivedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_runs` ADD CONSTRAINT `trip_runs_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `vehicles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_attendantId_fkey` FOREIGN KEY (`attendantId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `banks` ADD CONSTRAINT `banks_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_operations` ADD CONSTRAINT `cash_operations_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_operations` ADD CONSTRAINT `cash_operations_cashSessionId_fkey` FOREIGN KEY (`cashSessionId`) REFERENCES `cash_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_operations` ADD CONSTRAINT `cash_operations_reversesOperationId_fkey` FOREIGN KEY (`reversesOperationId`) REFERENCES `cash_operations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_operations` ADD CONSTRAINT `cash_operations_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_operations` ADD CONSTRAINT `cash_operations_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `operation_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_operations` ADD CONSTRAINT `cash_operations_subcategoryId_fkey` FOREIGN KEY (`subcategoryId`) REFERENCES `operation_subcategories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_operations` ADD CONSTRAINT `cash_operations_motifId_fkey` FOREIGN KEY (`motifId`) REFERENCES `operation_motifs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_operations` ADD CONSTRAINT `cash_operations_beneficiaryStaffId_fkey` FOREIGN KEY (`beneficiaryStaffId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_operations` ADD CONSTRAINT `cash_operations_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_operations` ADD CONSTRAINT `cash_operations_counterpartRegisterId_fkey` FOREIGN KEY (`counterpartRegisterId`) REFERENCES `cash_registers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_operations` ADD CONSTRAINT `cash_operations_bankId_fkey` FOREIGN KEY (`bankId`) REFERENCES `banks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_operations` ADD CONSTRAINT `cash_operations_chequeId_fkey` FOREIGN KEY (`chequeId`) REFERENCES `cheques`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_operations` ADD CONSTRAINT `cash_operations_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_registers` ADD CONSTRAINT `cash_registers_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_registers` ADD CONSTRAINT `cash_registers_holderId_fkey` FOREIGN KEY (`holderId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_sessions` ADD CONSTRAINT `cash_sessions_cashRegisterId_fkey` FOREIGN KEY (`cashRegisterId`) REFERENCES `cash_registers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_sessions` ADD CONSTRAINT `cash_sessions_openedById_fkey` FOREIGN KEY (`openedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_sessions` ADD CONSTRAINT `cash_sessions_closedById_fkey` FOREIGN KEY (`closedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cheques` ADD CONSTRAINT `cheques_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cheques` ADD CONSTRAINT `cheques_bankId_fkey` FOREIGN KEY (`bankId`) REFERENCES `banks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `operation_categories` ADD CONSTRAINT `operation_categories_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `operation_motifs` ADD CONSTRAINT `operation_motifs_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `operation_motifs` ADD CONSTRAINT `operation_motifs_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `operation_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `operation_subcategories` ADD CONSTRAINT `operation_subcategories_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `operation_categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_enrollmentFeeId_fkey` FOREIGN KEY (`enrollmentFeeId`) REFERENCES `enrollment_fees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_tenders` ADD CONSTRAINT `payment_tenders_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_tenders` ADD CONSTRAINT `payment_tenders_bankId_fkey` FOREIGN KEY (`bankId`) REFERENCES `banks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_tenders` ADD CONSTRAINT `payment_tenders_chequeId_fkey` FOREIGN KEY (`chequeId`) REFERENCES `cheques`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_schoolYearId_fkey` FOREIGN KEY (`schoolYearId`) REFERENCES `school_years`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_cancelledById_fkey` FOREIGN KEY (`cancelledById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_cashSessionId_fkey` FOREIGN KEY (`cashSessionId`) REFERENCES `cash_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `suppliers` ADD CONSTRAINT `suppliers_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `suppliers` ADD CONSTRAINT `suppliers_defaultCategoryId_fkey` FOREIGN KEY (`defaultCategoryId`) REFERENCES `operation_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `suppliers` ADD CONSTRAINT `suppliers_defaultSubcategoryId_fkey` FOREIGN KEY (`defaultSubcategoryId`) REFERENCES `operation_subcategories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `profiles` ADD CONSTRAINT `profiles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `profiles` ADD CONSTRAINT `profiles_jobFunctionId_fkey` FOREIGN KEY (`jobFunctionId`) REFERENCES `staff_functions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_functions` ADD CONSTRAINT `staff_functions_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_orgRoleId_fkey` FOREIGN KEY (`orgRoleId`) REFERENCES `roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_currentSchoolId_fkey` FOREIGN KEY (`currentSchoolId`) REFERENCES `schools`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_currentSchoolYearId_fkey` FOREIGN KEY (`currentSchoolYearId`) REFERENCES `school_years`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

