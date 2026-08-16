-- AlterTable
-- `changes` was declared as a bare String, which MySQL made VARCHAR(191). The
-- diff of a created row passes that on almost every table, so the insert failed
-- with P2000 and `append` — which never throws, by design — dropped the entry.
ALTER TABLE `activity_logs` MODIFY `changes` TEXT NULL;
