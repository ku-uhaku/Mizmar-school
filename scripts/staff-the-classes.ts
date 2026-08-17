import { db } from "@/prisma/seed/client";
import { db as appDb } from "@/lib/db";

import { teachingDaysOf } from "@/lib/school-settings";
import { SECOND_SUBJECTS } from "@/modules/hr/presets";
import { seedTeacherSubjects } from "@/modules/hr/seed";
import { allocateStaffCode } from "@/modules/hr/service";
import { loadSchoolSettings } from "@/lib/school-settings-server";
import { createLoginAccount } from "@/modules/users/service";

/**
 * Staffs a school's classes with the fewest teachers that can actually cover
 * them, and hires only the shortfall.
 *
 *   npm run db:staff-classes -- --school MIZMAR              # report only
 *   npm run db:staff-classes -- --school MIZMAR --write      # hire
 *
 * Report-only unless `--write`, like `db:carry-marks` and `db:move-misfiled`.
 *
 * ── Why this is a script and not a seed ─────────────────────────────────────
 * `prisma/seed.ts` sizes the demonstration's staff from `MOROCCAN_CURSUS` — the
 * constants it is about to write. This sizes a *real* school's from the classes
 * and the bell schedule already on file, which is a different question with a
 * different answer: a school set up through the wizard, with classes added by
 * hand since, has a programme nobody planned in advance. The two share the one
 * thing that should not be decided twice — which subjects a teacher may double
 * up on, `SECOND_SUBJECTS` in modules/hr/presets.ts.
 *
 * ── What "the minimum" means here ───────────────────────────────────────────
 * Three constraints, in the order they bite:
 *
 *   1. **A week has a ceiling.** Nobody can be given more minutes than there
 *      are teachable periods to hold them, and that number is read from the
 *      school's own bell schedule rather than assumed — the same
 *      `weekCapacityMinutes` the generator computes in
 *      modules/timetable/service.ts. Mizmar's is 36 periods × 60 minutes.
 *
 *   2. **A teacher is not interchangeable.** Dividing the whole programme by the
 *      ceiling gives a number no school could staff: it assumes one person can
 *      take arabic and physics. So demand is packed per *family* — a subject plus
 *      what its teachers may cover — and each family is rounded up on its own.
 *
 *   3. **The primaire is polyvalent.** An instituteur takes their own class for
 *      nearly all of its week, which is both how Moroccan primary schools work
 *      and, as it happens, the tightest possible packing: the class's whole week
 *      is one teacher's whole week, with no fragment left over. One post per
 *      class, and no arithmetic can do better.
 *
 * The result is a *floor*, and it is worth saying plainly: a family packed to
 * exactly 100% of its teachers' weeks leaves the generator no room to resolve a
 * clash, because two classes wanting the same subject in the same period is
 * unavoidable at that density. The report prints each family's load so the
 * tight ones are visible, and `--slack <n>` adds n% of headroom if the school
 * wants a schedulable plan rather than a minimal one.
 *
 * ── What it writes ──────────────────────────────────────────────────────────
 * Per hire: an account (`createLoginAccount`, so the profile, the language and
 * the colour are set the way the user form sets them), a `Staff` row with a
 * matricule from `allocateStaffCode`, and the qualifications through
 * `seedTeacherSubjects`, which scopes each to the cycle the subject is taught in.
 * No contract and no salary: what somebody is paid is a term of employment the
 * school negotiates, and inventing one would put a figure on a bulletin that
 * nobody agreed.
 *
 * Idempotent, keyed on the username: re-running hires nobody twice. It never
 * deletes and never demotes — an over-staffed school is reported, not trimmed.
 */

/** A post the programme pays for: what one teacher would be recruited as. */
type Post = {
  /** The subject they are recruited for; index 0 of their qualifications. */
  mainSubject: string;
  /** Everything they may be given, main subject first. */
  subjectCodes: string[];
  label: string;
  /** Minutes a week this post is expected to carry. */
  loadMinutes: number;
  /** The primaire's polyvalent posts name their class; the others do not. */
  className: string | null;
};

/** Demand for one subject, and where it is taught. */
type SubjectDemand = {
  code: string;
  label: string;
  minutes: number;
  cycles: Set<string>;
};

const PRIMARY_CYCLE = "PRIMARY";

/**
 * The smallest part-service worth a post of its own, as a share of a full week.
 *
 * A tenth — about three and a half hours here. Below that the hours are spread
 * over the family's existing posts rather than hiring somebody for them; see the
 * note in `planPosts`.
 *
 * It was a quarter, which minimised the head-count and produced a professeur
 * d'EPS on a forty-four-hour week: absorbing a quarter-service into a single full
 * post lands at 125% of a week nobody can work. A tenth keeps every absorbed post
 * inside 110%, which is a real timetable — one lesson over, not eight.
 */
const MIN_PART_SERVICE = 0.1;

/**
 * The primaire's `mainSubject`.
 *
 * A sentinel rather than a subject code, because an instituteur is not recruited
 * *for* one: they take the whole programme. Naming a real code here made the
 * polyvalent post answer to a subject hint, so `t.arabe1` was seated in front of
 * a 3AP class while three arabic posts went to new hires.
 */
const POLYVALENT = "__polyvalent__";

/**
 * Names for the people this hires, so a second run recognises them.
 *
 * Deterministic and ordinary Moroccan names rather than "Teacher 7": these
 * become rows a director reads, and a school that wants their real names types
 * them over these on the employee file. The list is walked in order and only as
 * far as the shortfall needs, so hiring one more next term does not renumber
 * anybody already on the payroll.
 */
const HIRE_NAMES: { first: string; last: string }[] = [
  { first: "Youssef", last: "Benali" },
  { first: "Khadija", last: "Amrani" },
  { first: "Rachid", last: "Ouazzani" },
  { first: "Samira", last: "Tazi" },
  { first: "Mehdi", last: "Chraibi" },
  { first: "Naima", last: "Berrada" },
  { first: "Karim", last: "Fassi" },
  { first: "Latifa", last: "Sebti" },
  { first: "Omar", last: "Idrissi" },
  { first: "Zineb", last: "Alami" },
  { first: "Hicham", last: "Bennani" },
  { first: "Souad", last: "Kettani" },
  { first: "Anas", last: "Lahlou" },
  { first: "Malika", last: "Sqalli" },
  { first: "Tarik", last: "Guessous" },
  { first: "Hanane", last: "Mernissi" },
  { first: "Adil", last: "Benjelloun" },
  { first: "Fatima", last: "Zouiten" },
  { first: "Nabil", last: "Cherkaoui" },
  { first: "Asma", last: "Belghiti" },
  { first: "Reda", last: "Skalli" },
  { first: "Imane", last: "Bouzidi" },
  { first: "Yassine", last: "Harrouchi" },
  { first: "Nadia", last: "Filali" },
];

async function main(): Promise<void> {
  const write = process.argv.includes("--write");
  const argOf = (name: string): string | null => {
    const at = process.argv.indexOf(`--${name}`);
    return at === -1 ? null : (process.argv[at + 1] ?? null);
  };

  const schoolCode = argOf("school");
  if (!schoolCode) throw new Error("--school <code> is required");
  const slackPercent = Number(argOf("slack") ?? 0) || 0;

  const school = await db.school.findFirst({ where: { code: schoolCode } });
  if (!school) throw new Error(`No school with code ${schoolCode}`);

  // The year in context, decided the same way `getAuthContext` decides it: the
  // default, else the active one, else the newest. A staffing plan is a fact
  // about one year — see the note on TeacherSubject.
  const year =
    (await db.schoolYear.findFirst({
      where: { schoolId: school.id, isDefault: true },
    })) ??
    (await db.schoolYear.findFirst({
      where: { schoolId: school.id, status: "ACTIVE" },
      orderBy: { startDate: "desc" },
    })) ??
    (await db.schoolYear.findFirst({
      where: { schoolId: school.id },
      orderBy: { startDate: "desc" },
    }));
  if (!year) throw new Error(`${school.name} has no school year`);

  console.log(
    `→ ${school.name} (${school.code}), ${year.name}${write ? "" : "   [dry run]"}\n`,
  );

  const capacityMinutes = await weekCapacity(school.id, year.id);
  if (capacityMinutes === 0) {
    throw new Error(
      "The bell schedule has no teachable periods, so no load can be planned.",
    );
  }

  const { classes, demand, primaryClasses, primarySubjects } =
    await readProgramme(school.id, year.id);
  if (classes === 0) throw new Error("This year has no classes.");

  const posts = planPosts({
    demand,
    primaryClasses,
    primarySubjects,
    capacityMinutes,
    slackPercent,
  });

  report({ classes, demand, capacityMinutes, posts, slackPercent });

  const existing = await existingTeachers(school.id, year.id);
  const shortfall = posts.length - existing.length;

  console.log(`\n  Teachers already on file : ${existing.length}`);
  console.log(`  Posts the programme needs: ${posts.length}`);
  console.log(
    `  To hire                  : ${shortfall > 0 ? shortfall : 0}` +
      (shortfall < 0 ? `   (${-shortfall} more than the minimum — nothing trimmed)` : ""),
  );

  // Existing teachers take the posts closest to what they already teach, so a
  // school that has declared its professeur de maths does not get a second one
  // hired beside them. The rest are filled in order of load, heaviest first.
  const filled = assignPosts(posts, existing);

  // Every one of them, not only the undeclared: "who ends up where" is the line
  // a director checks, and printing half of it left two primaire posts looking
  // unfilled when they were taken by somebody already on the payroll.
  console.log("\n  Teachers on file, and the post each takes:");
  for (const teacher of existing) {
    const post = filled.get(teacher.userId);
    const source =
      teacher.subjectCodes.length === 0
        ? "no declaration — guessed from the name"
        : `declared ${teacher.subjectCodes.join(", ")}`;
    console.log(
      `    ${teacher.username.padEnd(16)} → ${(post ? post.label : "(surplus — no post left)").padEnd(46)} ${source}`,
    );
  }

  const toHire = posts.filter((post) => !postTaken(filled, post));
  if (toHire.length > 0) {
    console.log(`\n  Hiring ${toHire.length}:`);
    for (const [index, post] of toHire.entries()) {
      const name = HIRE_NAMES[index % HIRE_NAMES.length];
      console.log(
        `    ${usernameFor(post, index).padEnd(16)} ${`${name.first} ${name.last}`.padEnd(22)} ${post.label}`,
      );
    }
  }

  if (!write) {
    console.log("\n  [dry run] Nothing written. Re-run with --write to apply.\n");
    return;
  }

  const password = process.env.STAFF_PASSWORD ?? "Mizmar@2026";
  const subjectIdByCode = await subjectIds(school.id);

  /** Everybody who ends up with a post, for one call to `seedTeacherSubjects`. */
  const qualified: { id: string; subjectCodes: string[] }[] = [];

  for (const [userId, post] of filled) {
    qualified.push({ id: userId, subjectCodes: post.subjectCodes });
  }

  let hired = 0;
  for (const [index, post] of toHire.entries()) {
    const name = HIRE_NAMES[index % HIRE_NAMES.length];
    const username = usernameFor(post, index);

    const held = await db.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (held) {
      // Already hired by an earlier run. Their qualifications are re-declared
      // below anyway, which is how a re-run repairs a half-finished one.
      qualified.push({ id: held.id, subjectCodes: post.subjectCodes });
      continue;
    }

    const account = await createLoginAccount({
      organizationId: school.organizationId,
      schoolId: school.id,
      firstName: name.first,
      lastName: name.last,
      username,
      email: null,
      phone: null,
      jobFunctionId: null,
      // No role, deliberately: a teacher needs no permission to be timetabled,
      // and inventing one would hand out access nobody asked for. See the note
      // in `createLoginAccount`.
      roleId: null,
      password,
    });
    if (!account.ok) {
      console.log(`    ! ${username}: ${account.reason}`);
      continue;
    }

    await db.staff.create({
      data: {
        schoolId: school.id,
        userId: account.userId,
        code: await allocateStaffCode(school.id),
        firstName: name.first,
        lastName: name.last,
        jobRole: "TEACHER",
        jobTitle: post.label,
        status: "ACTIVE",
        hiredOn: year.startDate,
      },
    });

    qualified.push({ id: account.userId, subjectCodes: post.subjectCodes });
    hired += 1;
  }

  await seedTeacherSubjects(db, {
    schoolId: school.id,
    schoolYearId: year.id,
    teachers: qualified,
    subjectIdByCode,
  });

  console.log(`\n  ${hired} hired, ${qualified.length} staffed.\n`);
}

/**
 * The week's ceiling, read off the school's own bell schedule.
 *
 * Deliberately the same three steps as `weekCapacityMinutes` in
 * modules/timetable/service.ts — teachable slots, on teaching days, times the
 * modal period — because a plan sized against a different ceiling from the one
 * the generator enforces is a plan the generator will reject.
 */
async function weekCapacity(
  schoolId: string,
  schoolYearId: string,
): Promise<number> {
  const settings = await loadSchoolSettings(schoolId);
  const teachingDays = new Set<number>(teachingDaysOf(settings));

  const slots = await db.timeSlot.findMany({
    where: {
      schoolYearId,
      scheduleKind: "STANDARD",
      isActive: true,
      // A break is not a period anything can be taught in.
      isBreak: false,
    },
    select: { dayOfWeek: true, startTime: true, endTime: true },
  });

  const teachable = slots.filter((slot) => teachingDays.has(slot.dayOfWeek));
  if (teachable.length === 0) return 0;

  // The commonest length, not the mean: one short slot at the end of Friday must
  // not re-scale the whole week.
  const tally = new Map<number, number>();
  for (const slot of teachable) {
    const length = minutesOfDay(slot.endTime) - minutesOfDay(slot.startTime);
    if (length > 0) tally.set(length, (tally.get(length) ?? 0) + 1);
  }
  let periodMinutes = 60;
  let best = 0;
  for (const [length, count] of tally) {
    if (count > best) {
      periodMinutes = length;
      best = count;
    }
  }

  return teachable.length * periodMinutes;
}

function minutesOfDay(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

/**
 * What the school has actually undertaken to teach this year.
 *
 * Read off the classes rather than off the cursus: a level the school configured
 * but opened no class in costs nothing to staff, and a class added by hand after
 * the wizard ran is exactly the case a constant would miss.
 *
 * Components are left out — a `Subject` with a parent is marked inside it and
 * never taught in its own hour, which is the same filter the generator applies.
 */
async function readProgramme(
  schoolId: string,
  schoolYearId: string,
): Promise<{
  classes: number;
  demand: Map<string, SubjectDemand>;
  primaryClasses: number;
  primarySubjects: string[];
}> {
  const classes = await db.schoolClass.findMany({
    where: {
      schoolId,
      isActive: true,
      levelOffering: { schoolYearId },
    },
    select: {
      levelOffering: {
        select: {
          levelId: true,
          trackId: true,
          level: {
            select: {
              educationLevelId: true,
              educationLevel: { select: { cycle: true } },
            },
          },
        },
      },
    },
  });

  const programme = await db.levelSubject.findMany({
    where: {
      level: { schoolId },
      subject: { isActive: true, parentId: null },
    },
    select: {
      levelId: true,
      trackId: true,
      weeklyMinutes: true,
      subject: { select: { code: true, name: true, shortName: true } },
    },
  });

  const demand = new Map<string, SubjectDemand>();
  const primarySubjects = new Set<string>();
  let primaryClasses = 0;

  for (const entry of classes) {
    const offering = entry.levelOffering;
    const cycle = offering.level.educationLevel.cycle;
    if (cycle === PRIMARY_CYCLE) primaryClasses += 1;

    for (const row of programme) {
      if (row.levelId !== offering.levelId) continue;
      // A row for every filière applies here; one naming a filière applies only
      // to that filière's classes.
      if (row.trackId !== null && row.trackId !== offering.trackId) continue;
      if (!row.weeklyMinutes) continue;

      const code = row.subject.code;
      const held = demand.get(code) ?? {
        code,
        label: row.subject.shortName ?? row.subject.name,
        minutes: 0,
        cycles: new Set<string>(),
      };
      held.minutes += row.weeklyMinutes;
      held.cycles.add(cycle);
      demand.set(code, held);

      if (cycle === PRIMARY_CYCLE) primarySubjects.add(code);
    }
  }

  return {
    classes: classes.length,
    demand,
    primaryClasses,
    primarySubjects: [...primarySubjects],
  };
}

/**
 * The posts the programme pays for.
 *
 * The primaire first, because its answer is not arithmetic: one polyvalent post
 * per class. Its minutes then come *out* of the demand the rest is sized from —
 * counting them twice is what would hire a specialist for a subject an
 * instituteur is already taking.
 */
function planPosts({
  demand,
  primaryClasses,
  primarySubjects,
  capacityMinutes,
  slackPercent,
}: {
  demand: Map<string, SubjectDemand>;
  primaryClasses: number;
  primarySubjects: string[];
  capacityMinutes: number;
  slackPercent: number;
}): Post[] {
  const posts: Post[] = [];

  // ── The primaire ──────────────────────────────────────────────────────────
  const primaryMinutes = [...demand.values()]
    .filter((subject) => subject.cycles.has(PRIMARY_CYCLE))
    .reduce((total, subject) => total + minutesInPrimary(subject), 0);

  for (let index = 0; index < primaryClasses; index += 1) {
    posts.push({
      mainSubject: POLYVALENT,
      // Qualified across the whole primaire programme, which is what polyvalent
      // means: the class's week is theirs, whatever is on it.
      subjectCodes: primarySubjects,
      label: "Instituteur polyvalent (primaire)",
      loadMinutes: primaryClasses === 0 ? 0 : Math.round(primaryMinutes / primaryClasses),
      // Named, which is what keeps its accounts `p.prim1…` rather than borrowing
      // the slug of whichever subject happens to head the primaire programme.
      className: "prim",
    });
  }

  // ── The secondary cycles ──────────────────────────────────────────────────
  // Whatever is left once the instituteurs have their classes.
  const remaining = new Map<string, number>();
  for (const subject of demand.values()) {
    const beyondPrimary = subject.minutes - minutesInPrimary(subject);
    if (beyondPrimary > 0) remaining.set(subject.code, beyondPrimary);
  }

  const families = groupIntoFamilies(remaining);
  const ceiling = Math.max(
    1,
    Math.round(capacityMinutes * (1 - slackPercent / 100)),
  );

  /*
    Full services first, then the remainders packed together.

    Rounding each family up on its own was the obvious thing and it wasted four
    posts here: seven families each left a part-service behind, and each of those
    parts got a whole post to itself — a professeur de SI on four hours a week
    beside a professeur d'EPS on twenty-two. A school does not hire like that. It
    gives one person a split service, which is what the second pass below builds,
    and only where `SECOND_SUBJECTS` says the two subjects go together.
  */
  const remainders: Family[] = [];
  for (const family of families) {
    const full = Math.floor(family.minutes / ceiling);
    for (let index = 0; index < full; index += 1) {
      posts.push({
        mainSubject: family.main,
        subjectCodes: family.subjectCodes,
        label: `Professeur de ${family.label}`,
        loadMinutes: ceiling,
        className: null,
      });
    }

    const left = family.minutes - full * ceiling;
    if (left <= 0) continue;

    /*
      A part-service worth having, or an hour to absorb.

      The arabic family came out at three full weeks and sixty minutes, and a
      fourth post for that one hour is not a job — it is a rounding error with a
      salary. Anything under a quarter of a service is spread over the family's
      own posts instead, which is what a school does: three teachers run twenty
      minutes over rather than a fourth being hired for one lesson. The report
      prints them past 100% so it stays visible.

      A family with no full post keeps its remainder whatever the size: somebody
      has to take the four hours of sciences de l'ingénieur.
    */
    if (full > 0 && left < ceiling * MIN_PART_SERVICE) {
      for (const post of posts) {
        if (post.mainSubject === family.main && post.className === null) {
          post.loadMinutes += Math.round(left / full);
        }
      }
      continue;
    }

    remainders.push({ ...family, minutes: left });
  }

  for (const post of packRemainders(remainders, ceiling)) posts.push(post);

  return posts;
}

/**
 * Turns the part-services left over into as few split posts as possible.
 *
 * Biggest remainder first, taking in whatever still fits and is a subject its
 * teacher could plausibly cover — `compatible` below is the same
 * `SECOND_SUBJECTS` judgement the families were built from, read in both
 * directions. Anything nobody can be paired with keeps its own post, which is
 * the honest answer: a four-hour service in sciences de l'ingénieur is a
 * vacataire, not a full-timer.
 */
function packRemainders(remainders: Family[], ceiling: number): Post[] {
  const posts: Post[] = [];
  const open = [...remainders].sort((a, b) => b.minutes - a.minutes);

  while (open.length > 0) {
    const lead = open.shift()!;
    let load = lead.minutes;
    const subjects = [...lead.subjectCodes];
    const labels = [lead.label];

    for (let index = 0; index < open.length; ) {
      const candidate = open[index];
      if (load + candidate.minutes <= ceiling && compatible(subjects, candidate)) {
        load += candidate.minutes;
        for (const code of candidate.subjectCodes) {
          if (!subjects.includes(code)) subjects.push(code);
        }
        labels.push(candidate.label);
        open.splice(index, 1);
        continue;
      }
      index += 1;
    }

    posts.push({
      mainSubject: lead.main,
      subjectCodes: subjects,
      label: `Professeur de ${labels.join(" / ")}`,
      loadMinutes: load,
      className: null,
    });
  }

  return posts;
}

/** Whether somebody already taking `subjects` could also take this family. */
function compatible(subjects: string[], family: Family): boolean {
  return subjects.some(
    (held) =>
      (SECOND_SUBJECTS[held] ?? []).includes(family.main) ||
      (SECOND_SUBJECTS[family.main] ?? []).includes(held),
  );
}

/**
 * How much of a subject's demand is the primaire's.
 *
 * Not derivable from the totals, so it is approximated by the share of cycles
 * the subject is taught in — good enough to keep the two halves of the plan from
 * counting the same hour twice, and honest about being an estimate. A subject
 * taught only in the primaire is entirely the primaire's, which is the case that
 * actually matters (Tamazight, activités scientifiques).
 */
function minutesInPrimary(subject: SubjectDemand): number {
  if (!subject.cycles.has(PRIMARY_CYCLE)) return 0;
  return Math.round(subject.minutes / subject.cycles.size);
}

/** A subject and everything one of its teachers may also be given. */
type Family = {
  main: string;
  label: string;
  subjectCodes: string[];
  minutes: number;
};

/**
 * Groups the remaining demand into the posts a school would actually recruit.
 *
 * Heaviest subject first, taking with it whatever `SECOND_SUBJECTS` says its
 * teachers may cover and nothing else has claimed. That is what turns "one post
 * per subject" — 15 of them here, several at a fifth of a week — into the
 * handful a school really hires: the professeur de maths takes l'informatique,
 * the professeur d'arabe takes l'éducation islamique.
 *
 * Greedy on purpose rather than optimal. The optimal packing of a dozen subjects
 * into whole services is a bin-packing problem whose answer is one or two posts
 * better and completely opaque to the director reading it; "the maths teacher
 * covers computing" is a plan somebody can check.
 */
function groupIntoFamilies(remaining: Map<string, number>): Family[] {
  const claimed = new Set<string>();
  const families: Family[] = [];

  const bySize = [...remaining.entries()].sort((a, b) => b[1] - a[1]);

  for (const [code, minutes] of bySize) {
    if (claimed.has(code)) continue;
    claimed.add(code);

    const covers = (SECOND_SUBJECTS[code] ?? []).filter(
      (second) => remaining.has(second) && !claimed.has(second),
    );
    let total = minutes;
    for (const second of covers) {
      claimed.add(second);
      total += remaining.get(second) ?? 0;
    }

    families.push({
      main: code,
      label: [code, ...covers].join(" / "),
      subjectCodes: [code, ...covers],
      minutes: total,
    });
  }

  return families;
}

/** Teachers this school already has, and what they are declared for. */
async function existingTeachers(
  schoolId: string,
  schoolYearId: string,
): Promise<{ userId: string; username: string; subjectCodes: string[] }[]> {
  // The same test the pickers use — see `teacherOfSchool` in lib/scope.ts. A
  // plan sized against the whole payroll would count the driver as a teacher.
  const staff = await db.staff.findMany({
    where: {
      schoolId,
      jobRole: "TEACHER",
      status: { in: ["ACTIVE", "ON_LEAVE", "SUSPENDED"] },
      user: { isActive: true },
    },
    select: {
      user: {
        select: {
          id: true,
          username: true,
          subjectsQualified: {
            where: { schoolYearId, isActive: true },
            select: { subject: { select: { code: true } } },
          },
        },
      },
    },
  });

  return staff
    .filter((row) => row.user !== null)
    .map((row) => ({
      userId: row.user!.id,
      username: row.user!.username,
      subjectCodes: row.user!.subjectsQualified.map((held) => held.subject.code),
    }));
}

/**
 * Puts the teachers already on file into posts.
 *
 * Declared specialists first, and only into a post for the subject they are
 * declared for: matching them loosely is how a school ends up with its
 * professeur de physique recruited as an instituteur while a physics post goes
 * to a new hire. Whoever is left takes whatever is still open, heaviest post
 * first, because an undeclared account is an account nobody has said anything
 * about.
 */
function assignPosts(
  posts: Post[],
  existing: { userId: string; username: string; subjectCodes: string[] }[],
): Map<string, Post> {
  const filled = new Map<string, Post>();
  const open = new Set(posts);

  /**
   * The open posts somebody's subject can be matched against.
   *
   * The polyvalent posts are deliberately not among them, and this is the third
   * time the same trap has been walked into: an instituteur is qualified for the
   * *whole* primaire programme, so its post's subject list contains everything
   * and wins any match made on that list. `t.hg` and `t.ism` were seated in front
   * of primaire classes that way while the posts they were declared for went to
   * new hires. A polyvalent post is a deliberate recruitment, so it is filled
   * last, from whoever their record says nothing about.
   */
  const subjectPosts = (): Post[] =>
    [...open].filter((post) => post.mainSubject !== POLYVALENT);

  /** The post that best fits a set of subject codes: recruited for, then covers. */
  const bestFor = (codes: string[]): Post | null =>
    subjectPosts().find((post) => codes.includes(post.mainSubject)) ??
    subjectPosts().find((post) =>
      post.subjectCodes.some((code) => codes.includes(code)),
    ) ??
    null;

  const take = (userId: string, post: Post): void => {
    open.delete(post);
    filled.set(userId, post);
  };

  // Declared specialists first, against what the school has actually said about
  // them. A declaration is the real answer and outranks every guess below.
  for (const teacher of existing) {
    if (teacher.subjectCodes.length === 0) continue;
    const match = bestFor(teacher.subjectCodes);
    if (match) take(teacher.userId, match);
  }

  // Then the undeclared, by what their own name hints at — see `subjectHint`.
  const blank: typeof existing = [];
  for (const teacher of existing) {
    if (filled.has(teacher.userId)) continue;
    const hint = subjectHint(teacher, subjectPosts());
    const match = hint ? bestFor([hint]) : null;
    if (match) take(teacher.userId, match);
    else blank.push(teacher);
  }

  // Whoever is left takes what is still open, lightest first: an account nobody
  // has said anything about is the last one to hand a full class to.
  const spare = [...open].sort((a, b) => a.loadMinutes - b.loadMinutes);
  for (const teacher of blank) {
    const post = spare.find((candidate) => open.has(candidate));
    if (!post) break;
    take(teacher.userId, post);
  }

  return filled;
}

/**
 * The subject an undeclared account's own name points at, if any.
 *
 * Reads the username for a subject code or one of the words a school actually
 * types — the accounts here are `t.math`, `t.arabe1`, `t.ph`. A guess, and
 * reported as one: the plan prints what it decided so a director can correct it
 * on the employee file, which is where the real answer lives.
 */
function subjectHint(
  teacher: { username: string },
  posts: Post[],
): string | null {
  const haystack = teacher.username.toLowerCase();
  const offered = new Set(posts.flatMap((post) => post.subjectCodes));

  for (const [word, code] of Object.entries(NAME_HINTS)) {
    if (offered.has(code) && haystack.includes(word)) return code;
  }
  for (const code of offered) {
    if (haystack.includes(code.toLowerCase())) return code;
  }
  return null;
}

/**
 * Words that name a subject in a Moroccan school's own shorthand, longest first
 * so `arabe` is tried before `ar` and `philo` before `ph`.
 */
const NAME_HINTS: Record<string, string> = {
  arabe: "AR",
  france: "FR",
  francais: "FR",
  anglais: "EN",
  philo: "PHILO",
  info: "INFO",
  maths: "MATH",
  math: "MATH",
  svt: "SVT",
  physique: "PC",
  ph: "PC",
  hg: "HG",
  islam: "ISL",
  ism: "ISL",
  eps: "EPS",
  sport: "EPS",
  art: "ART",
  amz: "AMZ",
};

function postTaken(filled: Map<string, Post>, post: Post): boolean {
  for (const held of filled.values()) if (held === post) return true;
  return false;
}

/**
 * The username a hire signs in with.
 *
 * Derived from the post rather than from the name, and this is what makes the
 * script idempotent: re-running finds `p.math1` already held and hires nobody,
 * whereas a name-derived username would be suffixed to `y.benali2` by
 * `allocateUsername` and open a second account for the same post.
 */
function usernameFor(post: Post, index: number): string {
  const slug = post.className
    ? post.className.toLowerCase()
    : post.mainSubject.toLowerCase();
  return `p.${slug}${index + 1}`;
}

function report({
  classes,
  demand,
  capacityMinutes,
  posts,
  slackPercent,
}: {
  classes: number;
  demand: Map<string, SubjectDemand>;
  capacityMinutes: number;
  posts: Post[];
  slackPercent: number;
}): void {
  const totalMinutes = [...demand.values()].reduce(
    (sum, subject) => sum + subject.minutes,
    0,
  );

  console.log(`  ${classes} classes, ${demand.size} subjects timetabled`);
  console.log(
    `  ${(totalMinutes / 60).toFixed(0)} h of lessons a week; one full service is ` +
      `${(capacityMinutes / 60).toFixed(0)} h` +
      (slackPercent > 0 ? `, planned to ${100 - slackPercent}% of it` : ""),
  );
  console.log("");

  // Summed, not overwritten: a group's posts do not all carry the same load —
  // three full services and a part one share a label — and printing the last
  // one's hours reported the arabic post as a one-hour job.
  const byLabel = new Map<string, { count: number; load: number }>();
  for (const post of posts) {
    const held = byLabel.get(post.label) ?? { count: 0, load: 0 };
    held.count += 1;
    held.load += post.loadMinutes;
    byLabel.set(post.label, held);
  }

  for (const [label, { count, load: total }] of byLabel) {
    const load = total / count;
    const percent = Math.round((load / capacityMinutes) * 100);
    // A post at or over 100% of a week is the one to look at: the generator has
    // no period left to move a clash into.
    const flag = percent >= 100 ? "  ← full week, no room for a clash" : "";
    console.log(
      `  ${String(count).padStart(2)} × ${label.padEnd(44)} ${(load / 60).toFixed(0).padStart(2)} h/week  ${String(percent).padStart(3)}%${flag}`,
    );
  }
}

/** Every subject the school declares, by code — what the qualifications key on. */
async function subjectIds(schoolId: string): Promise<Record<string, string>> {
  const subjects = await db.subject.findMany({
    where: { schoolId },
    select: { id: true, code: true },
  });
  return Object.fromEntries(subjects.map((subject) => [subject.code, subject.id]));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Two pools, not one: this reaches `createLoginAccount`, which holds the
    // app's own client from lib/db.ts. Disconnecting only the seed's left five
    // idle sockets open and the script hung after printing its last line.
    await db.$disconnect();
    await appDb.$disconnect();
  });
