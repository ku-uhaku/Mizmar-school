-- Data migration, written by hand: `prisma migrate diff` can express the shape
-- change but not the copy, and dropping `expense_categories` without this would
-- take every posted décaissement's rubrique with it.
--
-- The ids are carried over unchanged, which is the whole trick: every
-- `cash_operations.expenseCategoryId` already in the table stays valid as a
-- `categoryId`, so the second statement is a straight copy rather than a join
-- through a mapping table.
--
-- `kind = 'OUT'` because that is what an ExpenseCategory always was. A school
-- that wants one of them on the encaissement side changes it in the
-- configuration afterwards.

INSERT INTO "operation_categories"
  ("id", "schoolId", "code", "name", "nameAr", "kind", "position", "isActive", "createdAt", "updatedAt")
SELECT
  "id", "schoolId", "code", "name", "nameAr", 'OUT', "position", "isActive", "createdAt", "updatedAt"
FROM "expense_categories";

UPDATE "cash_operations"
SET "categoryId" = "expenseCategoryId"
WHERE "expenseCategoryId" IS NOT NULL;
