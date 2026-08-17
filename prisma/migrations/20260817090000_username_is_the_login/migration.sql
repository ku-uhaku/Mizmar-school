-- The username is the credential, and the email address is optional.
--
-- Nothing signs in with `email` any more (lib/auth.ts looks in `username` and
-- no other column), so a NULL username stopped meaning "signs in elsewhere" and
-- started meaning "locked out". Hence the order below: backfill first, then
-- tighten `username`, then loosen `email`.

-- Backfill, step 1 — the local part of the address, where it is free, valid as a
-- username, and not claimed twice inside this same statement. `admin@x.ma`
-- becomes `admin`, which is what the seed already derives, so a migrated school
-- and a seeded one agree about what everybody types.
UPDATE `users` AS `u`
JOIN (
  SELECT `id`, `candidate`
  FROM (
    SELECT
      `id`,
      LOWER(SUBSTRING_INDEX(`email`, '@', 1)) AS `candidate`,
      ROW_NUMBER() OVER (
        PARTITION BY LOWER(SUBSTRING_INDEX(`email`, '@', 1))
        ORDER BY `createdAt`, `id`
      ) AS `seat`
    FROM `users`
    WHERE `username` IS NULL
  ) AS `ranked`
  -- The same shape USERNAME_PATTERN accepts, so what lands here is a username
  -- the form can also save back.
  WHERE `seat` = 1 AND `candidate` REGEXP '^[a-z0-9][a-z0-9._-]{2,29}$'
) AS `pick` ON `pick`.`id` = `u`.`id`
LEFT JOIN (SELECT `username` FROM `users` WHERE `username` IS NOT NULL) AS `taken`
  ON `taken`.`username` = `pick`.`candidate`
SET `u`.`username` = `pick`.`candidate`
WHERE `u`.`username` IS NULL AND `taken`.`username` IS NULL;

-- Backfill, step 2 — anything the first pass could not name takes its own id: a
-- cuid is lowercase alphanumeric and 25 characters, so it is both unique by
-- construction and a valid username. Ugly to type and deliberately so — nobody
-- is locked out, and an administrator reissues it from /users.
UPDATE `users` SET `username` = `id` WHERE `username` IS NULL;

-- AlterTable
ALTER TABLE `users` MODIFY `username` VARCHAR(191) NOT NULL;
ALTER TABLE `users` MODIFY `email` VARCHAR(191) NULL;

-- The throttle counts usernames now, so the column that holds what was typed is
-- no longer an address. A rename rather than a drop and add: the counters in
-- flight are what stop a grind that is already under way.
ALTER TABLE `login_attempts` RENAME COLUMN `email` TO `identifier`;
ALTER TABLE `login_attempts`
  RENAME INDEX `login_attempts_email_key` TO `login_attempts_identifier_key`;
