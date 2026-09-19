


-- CreateTable
CREATE TABLE `credit_ledger` (
    `id` VARCHAR(30) NOT NULL,
    `organizationId` VARCHAR(30) NOT NULL,
    `delta` INTEGER NOT NULL,
    `reason` VARCHAR(20) NOT NULL,
    `campaignId` VARCHAR(30) NULL,
    `note` TEXT NULL,
    `createdById` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `credit_ledger_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    INDEX `credit_ledger_campaignId_idx`(`campaignId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message_campaigns` (
    `id` VARCHAR(30) NOT NULL,
    `organizationId` VARCHAR(30) NOT NULL,
    `schoolId` VARCHAR(30) NOT NULL,
    `kind` VARCHAR(30) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    `template` TEXT NOT NULL,
    `remark` TEXT NULL,
    `filters` TEXT NOT NULL,
    `reservedCredits` INTEGER NOT NULL DEFAULT 0,
    `createdById` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `message_campaigns_organizationId_idx`(`organizationId`),
    INDEX `message_campaigns_schoolId_status_idx`(`schoolId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message_credits` (
    `id` VARCHAR(30) NOT NULL,
    `organizationId` VARCHAR(30) NOT NULL,
    `balance` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `message_credits_organizationId_key`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message_deliveries` (
    `id` VARCHAR(30) NOT NULL,
    `campaignId` VARCHAR(30) NOT NULL,
    `familyId` VARCHAR(30) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `body` TEXT NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `error` VARCHAR(500) NULL,
    `claimedAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `message_deliveries_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `message_deliveries_familyId_sentAt_idx`(`familyId`, `sentAt`),
    UNIQUE INDEX `message_deliveries_campaignId_familyId_key`(`campaignId`, `familyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `credit_ledger` ADD CONSTRAINT `credit_ledger_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_campaigns` ADD CONSTRAINT `message_campaigns_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_campaigns` ADD CONSTRAINT `message_campaigns_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_credits` ADD CONSTRAINT `message_credits_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_deliveries` ADD CONSTRAINT `message_deliveries_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `message_campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

