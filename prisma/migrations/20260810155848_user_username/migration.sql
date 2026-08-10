-- AlterTable
ALTER TABLE "users" ADD COLUMN "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");


-- ─────────────────────────────────────────────────────────────────────────────
--  Give the staff who already have accounts a username to sign in with.
--
--  The web login form asks for a username, so every existing member of staff
--  needs one before this ships or they cannot get in. Derived from the local
--  part of their email — `karim.bennis@almanar.ma` becomes `karim.bennis` —
--  which is what they already type and already recognise.
--
--  Deliberately self-limiting. A row is only given a username when all four
--  hold, and is otherwise left null for an administrator to set:
--
--    1. it is staff — an org role, a membership, or the super admin. Guardians
--       are skipped: they sign in on the phone, with their email, and a
--       username is one more thing for a parent to forget.
--    2. the local part is unique across every account, so two people at
--       different domains cannot be handed the same username and have the
--       unique index refuse the second at random.
--    3. it is a shape `USERNAME_PATTERN` would accept, so nothing lands in the
--       column that the form would then refuse to save back.
--    4. it is long enough to be a username at all.
--
--  Left null is a safe outcome and not a locked-out one: `checkCredentials`
--  falls back to the email address, so an account with no username signs in
--  exactly as it did yesterday.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE "users"
SET "username" = lower(substr("email", 1, instr("email", '@') - 1))
WHERE instr("email", '@') > 3
  AND "isActive" = true
  AND (
        "isSuperAdmin" = true
     OR "orgRoleId" IS NOT NULL
     OR EXISTS (SELECT 1 FROM "memberships" m WHERE m."userId" = "users"."id")
  )
  AND lower(substr("email", 1, instr("email", '@') - 1))
      GLOB '[a-z0-9][a-z0-9._-]*'
  AND length(substr("email", 1, instr("email", '@') - 1)) BETWEEN 3 AND 30
  AND (
        SELECT COUNT(*) FROM "users" u2
        WHERE lower(substr(u2."email", 1, instr(u2."email", '@') - 1))
            = lower(substr("users"."email", 1, instr("users"."email", '@') - 1))
      ) = 1;
