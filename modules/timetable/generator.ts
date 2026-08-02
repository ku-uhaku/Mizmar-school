/**
 * How a week's grid is laid out, as a pure function.
 *
 * Kept apart from `service.ts` — which does the loading and the writing — for
 * the same reason `modules/enrolment/schedule.ts` is: the rule has exactly one
 * implementation, so the preview a user approves and the rows that get written
 * cannot be produced by two different pieces of code that drift apart.
 *
 * No database, no `server-only`, no randomness the caller cannot reproduce:
 * everything it needs is passed in, including the seed. That last part is what
 * makes "apply what I just previewed" honest — see `applyTimetableDraft`.
 *
 * ── What it is, and what it is not ──────────────────────────────────────────
 * This is a randomised greedy placer with restarts, not an optimal solver.
 * Timetabling is NP-hard and a school does not want the optimum; it wants a
 * grid that breaks no rule, spreads a subject across the week rather than
 * stacking it on Tuesday, and can be re-rolled in a second when the head of
 * studies dislikes it. So: place the hardest demands first, score the
 * candidates, jitter the ties, run it a few times and keep the best.
 *
 * It never lies about failure. A subject it could not place in full comes back
 * as a shortfall, and the screen says so instead of quietly billing the school
 * four hours of maths a week when the programme asks for six.
 *
 * ── The four rules it may not break ─────────────────────────────────────────
 * The same four `findClash` enforces on every manual edit, checked here against
 * in-memory sets so a run of two hundred placements is not two hundred round
 * trips:
 *
 *   1. a class cannot be in two places at once
 *   2. a teacher cannot be in two rooms at once
 *   3. a room cannot host two classes at once
 *   4. a teacher cannot be booked in a period they do not work
 *
 * They are hard constraints: a candidate breaking one is never scored, only
 * discarded. Everything else in `scoreCandidate` is a preference, and a grid
 * that satisfies none of them is still a legal grid.
 */

// ── Randomness you can hand back ─────────────────────────────────────────────

/**
 * mulberry32 — a small, fast, seeded PRNG.
 *
 * Written out rather than pulled in because the whole point is that this exact
 * sequence is reproducible from an integer: the client previews with seed
 * 84213, sends 84213 back, and the server lays out the same grid. `Math.random`
 * would make "apply this preview" a lie.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh seed for the first draw, and for every re-roll after it. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

// ── What goes in ─────────────────────────────────────────────────────────────

export type GeneratorSlot = {
  id: string;
  /** ISO weekday, 1 = Monday. */
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  /** "MORNING" | "AFTERNOON" — see DAY_SESSIONS. */
  session: string;
};

/**
 * One subject's weekly requirement for one class.
 *
 * `periods` is already in periods, not minutes: turning "270 minutes a week"
 * into "three hours" needs the bell schedule, which the loader has and this
 * does not. See `periodsFromMinutes`.
 */
export type GeneratorDemand = {
  schoolClassId: string;
  subjectId: string;
  /** Set only for a lesson taught to half the class — see ClassGroup. */
  classGroupId: string | null;
  /**
   * Who may take it, best first.
   *
   * One entry when a TeachingAssignment already names somebody — the school has
   * decided and the generator does not second-guess it. Otherwise every teacher
   * qualified for the subject, ordered by preference and then by how loaded they
   * already are, and the placer *chooses*. That choice is the assignment: it is
   * written back as a TeachingAssignment when the draft is applied.
   *
   * Empty means nobody in the building can take it. The lesson is still placed,
   * teacherless, because a grid with a hole in the teacher column is more
   * useful than a hole in the week — and it is reported either way.
   */
  candidateTeachers: string[];
  /** True when the school already named a teacher, so nothing is being decided. */
  teacherWasAssigned: boolean;
  /** The class's own room. Preferred, never required — see the note in `attempt`. */
  homeRoomId: string | null;
  /** `Subject.requiresLab` — narrows which rooms will do. */
  requiresLab: boolean;
  /** Pupils to seat, for rejecting a room too small. 0 when unknown. */
  classSize: number;
  periods: number;
  /**
   * Periods to place back-to-back where the week allows it. 2 puts SVT on for
   * a double, 1 spreads every hour. Never more than what is left to place.
   */
  blockSize: number;
  /** Most periods of this subject in one day. Keeps six hours of maths off Monday. */
  maxPerDay: number;
};

/** A room the generator may put a class in. */
export type GeneratorRoom = {
  id: string;
  /** See ROOM_KINDS. Decides whether it satisfies `requiresLab`. */
  kind: string;
  /** Null when the school has not said. Treated as "big enough". */
  capacity: number | null;
};

export type GeneratorInput = {
  /** Teaching periods only — breaks are filtered out by the loader. */
  slots: GeneratorSlot[];
  demands: GeneratorDemand[];
  /** Every room the school may timetable into. */
  rooms: GeneratorRoom[];
  /** Slot ids already taken, keyed by teacher / room / class. */
  busyTeacher: Record<string, string[]>;
  busyRoom: Record<string, string[]>;
  busyClass: Record<string, string[]>;
  /** Periods a teacher does not work at all — TeacherUnavailability. */
  unavailableTeacher: Record<string, string[]>;
  /**
   * How long one period is. The load caps below are in minutes because that is
   * what a contract and a programme are written in; the placer counts periods
   * and converts with this.
   */
  periodMinutes: number;
  /**
   * Most minutes a week each teacher may be given — `Staff.maxWeeklyMinutes`,
   * falling back to the school's standard service. A teacher missing from the
   * map is uncapped.
   */
  teacherCapacity: Record<string, number>;
  /** Minutes each teacher is already carrying, from grids not being redrawn. */
  teacherLoad: Record<string, number>;
  /** Most minutes of lessons a week any one class may be given. */
  classCapacity: number;
  /** Minutes each class already holds, for a top-up run. */
  classLoad: Record<string, number>;
  /**
   * Room kinds that satisfy `requiresLab` — LAB_ROOM_KINDS from
   * modules/facilities/enums.ts, passed in so this file stays free of imports
   * from another module's enums and testable on its own.
   */
  labRoomKinds: readonly string[];
  seed: number;
  /**
   * How many times to lay the whole thing out before keeping the best.
   *
   * Restarts are what make a greedy placer respectable: a run that paints
   * itself into a corner on the third subject is thrown away rather than
   * patched. Eight is enough to matter and fast enough to feel instant on a
   * school-sized week.
   */
  attempts?: number;
};

// ── What comes out ───────────────────────────────────────────────────────────

/** One lesson, in the consecutive periods it occupies. */
export type Placement = {
  schoolClassId: string;
  subjectId: string;
  classGroupId: string | null;
  teacherId: string | null;
  roomId: string | null;
  /** One per period, in order. A double period is two ids. */
  timeSlotIds: string[];
};

/**
 * A teacher the generator picked for a subject nobody was assigned to.
 *
 * This is the affectation. Applying the draft writes it as a
 * `TeachingAssignment`, so the choice survives in the class file rather than
 * living only inside a grid.
 */
export type TeacherChoice = {
  schoolClassId: string;
  subjectId: string;
  classGroupId: string | null;
  teacherId: string;
};

/** A subject the week could not fit, and by how much. */
export type Shortfall = {
  schoolClassId: string;
  subjectId: string;
  /** Periods asked for that found no home. */
  missing: number;
};

export type GeneratorResult = {
  placements: Placement[];
  shortfalls: Shortfall[];
  /** Teachers the generator chose, for subjects that had none. */
  assignments: TeacherChoice[];
  /** Periods actually placed. */
  placedPeriods: number;
  /** Periods asked for. */
  requestedPeriods: number;
};

// ── Turning a programme into periods ─────────────────────────────────────────

/**
 * How many periods a weekly minute figure buys.
 *
 * Rounded to the nearest whole period rather than down: a programme asking for
 * 90 minutes against 55-minute periods means two, and giving it one would quietly
 * halve the subject. A figure below half a period still buys one — the school
 * declared the subject, so it gets an hour.
 */
export function periodsFromMinutes(
  weeklyMinutes: number,
  periodMinutes: number,
): number {
  if (periodMinutes <= 0) return 0;
  return Math.max(1, Math.round(weeklyMinutes / periodMinutes));
}

// ── The placer ───────────────────────────────────────────────────────────────

/** Consecutive teaching periods of one day, in clock order. */
type DayRun = GeneratorSlot[];

function minutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Groups the week into the runs of genuinely back-to-back periods.
 *
 * Adjacency is `endTime === startTime`, so the morning break splits a day into
 * two runs on its own — no need to know which slot the break was. That is what
 * stops a "double period" being scheduled either side of the récréation.
 */
function runsByDay(slots: GeneratorSlot[]): Map<number, DayRun[]> {
  const byDay = new Map<number, GeneratorSlot[]>();
  for (const slot of slots) {
    const day = byDay.get(slot.dayOfWeek) ?? [];
    day.push(slot);
    byDay.set(slot.dayOfWeek, day);
  }

  const runs = new Map<number, DayRun[]>();
  for (const [day, daySlots] of byDay) {
    const ordered = [...daySlots].sort(
      (a, b) => minutes(a.startTime) - minutes(b.startTime),
    );

    const dayRuns: DayRun[] = [];
    let current: DayRun = [];

    for (const slot of ordered) {
      const last = current[current.length - 1];
      if (last && last.endTime === slot.startTime) {
        current.push(slot);
      } else {
        if (current.length > 0) dayRuns.push(current);
        current = [slot];
      }
    }
    if (current.length > 0) dayRuns.push(current);

    runs.set(day, dayRuns);
  }

  return runs;
}

/** Every window of `size` consecutive periods the week offers, by day. */
function windowsOfSize(
  runs: Map<number, DayRun[]>,
  size: number,
): { dayOfWeek: number; slots: GeneratorSlot[] }[] {
  const windows: { dayOfWeek: number; slots: GeneratorSlot[] }[] = [];

  for (const [day, dayRuns] of runs) {
    for (const run of dayRuns) {
      for (let start = 0; start + size <= run.length; start += 1) {
        windows.push({ dayOfWeek: day, slots: run.slice(start, start + size) });
      }
    }
  }

  return windows;
}

/** The mutable bookings one attempt builds up as it places. */
type Ledger = {
  teacher: Map<string, Set<string>>;
  room: Map<string, Set<string>>;
  class: Map<string, Set<string>>;
  /** `classId:subjectId:day` → periods already placed that day. */
  perDay: Map<string, number>;
  /** `classId:day` → periods of any subject that day, for levelling the load. */
  dayLoad: Map<string, number>;
  /** Minutes each teacher is carrying, against `teacherCapacity`. */
  teacherMinutes: Map<string, number>;
  /** Minutes each class is carrying, against `classCapacity`. */
  classMinutes: Map<string, number>;
};

function ledgerFrom(input: GeneratorInput): Ledger {
  const toMap = (source: Record<string, string[]>) =>
    new Map(
      Object.entries(source).map(([key, ids]) => [key, new Set(ids)] as const),
    );

  return {
    teacher: toMap(input.busyTeacher),
    room: toMap(input.busyRoom),
    class: toMap(input.busyClass),
    perDay: new Map(),
    dayLoad: new Map(),
    teacherMinutes: new Map(Object.entries(input.teacherLoad)),
    classMinutes: new Map(Object.entries(input.classLoad)),
  };
}

/**
 * Every change one demand made, so a failed attempt at a teacher can be undone.
 *
 * The placer tries each candidate teacher in turn and keeps the first who can
 * take the *whole* subject, which means half-finished attempts have to be rolled
 * back cleanly. A journal of exactly what was added is cheaper and far less
 * error-prone than deep-copying the ledger for every candidate.
 */
type Journal = {
  bookings: { ledger: Map<string, Set<string>>; key: string; slotId: string }[];
  counters: { map: Map<string, number>; key: string; delta: number }[];
  placements: number;
};

function undo(journal: Journal, placements: Placement[]) {
  for (const entry of journal.bookings) {
    entry.ledger.get(entry.key)?.delete(entry.slotId);
  }
  for (const entry of journal.counters) {
    entry.map.set(entry.key, (entry.map.get(entry.key) ?? 0) - entry.delta);
  }
  placements.length -= journal.placements;
}

function taken(ledger: Map<string, Set<string>>, key: string, slotId: string) {
  return ledger.get(key)?.has(slotId) ?? false;
}

function book(ledger: Map<string, Set<string>>, key: string, slotId: string) {
  const held = ledger.get(key) ?? new Set<string>();
  held.add(slotId);
  ledger.set(key, held);
}

/**
 * Whether a window is free for this class, this teacher and this room.
 *
 * Unavailability is checked against the *input* rather than the ledger: it is a
 * standing arrangement that nothing this run does can change, which is why it
 * never gets booked into.
 */
function isLegal(
  window: { slots: GeneratorSlot[] },
  schoolClassId: string,
  teacherId: string | null,
  roomId: string | null,
  ledger: Ledger,
  unavailable: Map<string, Set<string>>,
): boolean {
  for (const slot of window.slots) {
    if (taken(ledger.class, schoolClassId, slot.id)) return false;
    if (teacherId) {
      if (taken(ledger.teacher, teacherId, slot.id)) return false;
      if (unavailable.get(teacherId)?.has(slot.id)) return false;
    }
    if (roomId && taken(ledger.room, roomId, slot.id)) return false;
  }
  return true;
}

/** Whether a room will do for this subject and this many pupils. */
function roomSuits(
  room: GeneratorRoom,
  demand: GeneratorDemand,
  labKinds: ReadonlySet<string>,
): boolean {
  if (demand.requiresLab && !labKinds.has(room.kind)) return false;
  // A room the school never sized is treated as big enough: an unknown capacity
  // is missing data, not a small room, and refusing it would empty the pool in
  // any school that has not measured its salles.
  if (room.capacity !== null && demand.classSize > room.capacity) return false;
  return true;
}

/**
 * How much this school would dislike the window. Lower is better.
 *
 * Every term here is a preference, not a rule — a grid that scores badly is
 * still a legal grid. They encode what a head of studies does by hand:
 *
 *   · **spread the subject.** The heaviest penalty by far. Three hours of
 *     French on Thursday and none the rest of the week is the single thing
 *     that makes a generated grid unusable.
 *   · **level the days.** A Monday of seven periods against a Friday of two is
 *     nobody's idea of a week, even when both are legal.
 *   · **mornings first.** Moroccan schools teach the substantial subjects in
 *     the morning session; this is a nudge, not a rule, so an afternoon-heavy
 *     class still gets a grid.
 *   · **jitter.** Ties are broken at random rather than by slot order, which is
 *     what stops every class in the school being handed the same shape of week.
 */
function scoreCandidate(
  window: { dayOfWeek: number; slots: GeneratorSlot[] },
  demand: GeneratorDemand,
  ledger: Ledger,
  random: () => number,
): number {
  const subjectKey = `${demand.schoolClassId}:${demand.subjectId}:${window.dayOfWeek}`;
  const loadKey = `${demand.schoolClassId}:${window.dayOfWeek}`;

  const sameSubjectToday = ledger.perDay.get(subjectKey) ?? 0;
  const periodsToday = ledger.dayLoad.get(loadKey) ?? 0;
  const afternoonPeriods = window.slots.filter(
    (slot) => slot.session === "AFTERNOON",
  ).length;

  return (
    sameSubjectToday * 100 +
    periodsToday * 6 +
    afternoonPeriods * 2 +
    random() * 5
  );
}

/**
 * Places one subject's whole weekly requirement, with one named teacher.
 *
 * Returns how many periods it managed and journals every change, so a caller
 * trying several teachers can put the ledger back exactly as it found it.
 *
 * ── One teacher per subject per class ───────────────────────────────────────
 * The whole demand goes to one person or it is reported short. A class does not
 * want three different maths teachers across its week, and splitting a subject
 * to squeeze the last hour in would be the placer optimising for its own score
 * against what the school actually wants.
 */
function placeDemand(
  demand: GeneratorDemand,
  teacherId: string | null,
  input: GeneratorInput,
  runs: Map<number, DayRun[]>,
  ledger: Ledger,
  unavailable: Map<string, Set<string>>,
  labKinds: ReadonlySet<string>,
  placements: Placement[],
  random: () => number,
): { placed: number; journal: Journal } {
  const journal: Journal = { bookings: [], counters: [], placements: 0 };

  const bookInto = (map: Map<string, Set<string>>, key: string, slotId: string) => {
    book(map, key, slotId);
    journal.bookings.push({ ledger: map, key, slotId });
  };
  const bump = (map: Map<string, number>, key: string, delta: number) => {
    map.set(key, (map.get(key) ?? 0) + delta);
    journal.counters.push({ map, key, delta });
  };

  /* The rooms that would do for this lesson, best first.

     The class's own room leads, because a class keeps its salle unless the week
     forces otherwise. Then anything else suitable, smallest first — putting a
     class of twelve in the eighty-seat amphi wastes the only room the big class
     could have used. Null is last and always available: a lesson with no room
     is a valid TimetableEntry and infinitely better than an hour nobody teaches,
     which is not recoverable by editing. */
  const home = demand.homeRoomId
    ? input.rooms.find((room) => room.id === demand.homeRoomId)
    : undefined;
  const fallbacks = input.rooms
    .filter((room) => room.id !== demand.homeRoomId && roomSuits(room, demand, labKinds))
    .sort((a, b) => (a.capacity ?? 9999) - (b.capacity ?? 9999))
    .map((room) => room.id);

  const roomChoices: (string | null)[] = [
    ...(home && roomSuits(home, demand, labKinds) ? [home.id] : []),
    ...fallbacks,
    null,
  ];

  let remaining = demand.periods;
  let placed = 0;

  while (remaining > 0) {
    let placedBlock = false;

    // Longest block that still fits in what is left, shrinking to a single
    // period rather than abandoning the hour.
    for (
      let size = Math.min(demand.blockSize, remaining);
      size >= 1 && !placedBlock;
      size -= 1
    ) {
      // Both ceilings are checked before anything is offered: a class that has
      // had its 30 hours and a teacher who has had their 22 are both full, and
      // the placer must stop rather than report a grid nobody can staff.
      const classKey = demand.schoolClassId;
      const classAfter =
        (ledger.classMinutes.get(classKey) ?? 0) + size * input.periodMinutes;
      if (input.classCapacity > 0 && classAfter > input.classCapacity) break;

      if (teacherId) {
        const cap = input.teacherCapacity[teacherId];
        const after =
          (ledger.teacherMinutes.get(teacherId) ?? 0) + size * input.periodMinutes;
        if (cap !== undefined && cap > 0 && after > cap) break;
      }

      const ofSize = windowsOfSize(runs, size).filter((window) => {
        const key = `${demand.schoolClassId}:${demand.subjectId}:${window.dayOfWeek}`;
        return (ledger.perDay.get(key) ?? 0) + size <= demand.maxPerDay;
      });
      if (ofSize.length === 0) continue;

      for (const roomId of roomChoices) {
        const candidates = ofSize.filter((window) =>
          isLegal(window, demand.schoolClassId, teacherId, roomId, ledger, unavailable),
        );
        if (candidates.length === 0) continue;

        let best = candidates[0];
        let bestScore = Number.POSITIVE_INFINITY;
        for (const candidate of candidates) {
          const score = scoreCandidate(candidate, demand, ledger, random);
          if (score < bestScore) {
            bestScore = score;
            best = candidate;
          }
        }

        for (const slot of best.slots) {
          bookInto(ledger.class, demand.schoolClassId, slot.id);
          if (teacherId) bookInto(ledger.teacher, teacherId, slot.id);
          if (roomId) bookInto(ledger.room, roomId, slot.id);
        }

        const span = best.slots.length;
        bump(
          ledger.perDay,
          `${demand.schoolClassId}:${demand.subjectId}:${best.dayOfWeek}`,
          span,
        );
        bump(ledger.dayLoad, `${demand.schoolClassId}:${best.dayOfWeek}`, span);
        bump(ledger.classMinutes, demand.schoolClassId, span * input.periodMinutes);
        if (teacherId) {
          bump(ledger.teacherMinutes, teacherId, span * input.periodMinutes);
        }

        placements.push({
          schoolClassId: demand.schoolClassId,
          subjectId: demand.subjectId,
          classGroupId: demand.classGroupId,
          teacherId,
          roomId,
          timeSlotIds: best.slots.map((slot) => slot.id),
        });
        journal.placements += 1;

        placed += span;
        remaining -= span;
        placedBlock = true;
        break;
      }
    }

    if (!placedBlock) break;
  }

  return { placed, journal };
}

/**
 * Lays out every demand once, greedily.
 *
 * Demands are taken hardest-first — most periods, then least room to move — and
 * the order is jittered so that restarts explore genuinely different grids
 * rather than the same one twice.
 *
 * ── Choosing the teacher is part of laying out the week ─────────────────────
 * Where the school has already named somebody, that is the only candidate and
 * nothing is being decided. Where it has not, every qualified teacher is tried
 * in turn — least loaded first, so the work spreads instead of piling on
 * whoever happens to sort first — and the first who can take the whole subject
 * gets it. That is the affectation, and it is written back as a
 * TeachingAssignment when the draft is applied.
 *
 * Candidates that cannot take the whole subject are rolled back rather than
 * left half-placed, and the best partial is replayed only if nobody can manage
 * it in full. Replaying is exact: the ledger is restored first and the placer
 * is deterministic.
 */
function attempt(input: GeneratorInput, seed: number): GeneratorResult {
  const random = seededRandom(seed);
  const runs = runsByDay(input.slots);
  const ledger = ledgerFrom(input);
  const unavailable = new Map(
    Object.entries(input.unavailableTeacher).map(
      ([key, ids]) => [key, new Set(ids)] as const,
    ),
  );
  const labKinds = new Set(input.labRoomKinds);

  const ordered = [...input.demands]
    .map((demand) => ({ demand, jitter: random() }))
    .sort(
      (a, b) =>
        b.demand.periods - a.demand.periods ||
        b.demand.blockSize - a.demand.blockSize ||
        a.jitter - b.jitter,
    )
    .map((entry) => entry.demand);

  const placements: Placement[] = [];
  const shortfalls: Shortfall[] = [];
  const assignments: TeacherChoice[] = [];
  let placedPeriods = 0;
  let requestedPeriods = 0;

  for (const demand of ordered) {
    requestedPeriods += demand.periods;

    // Least loaded first. Ties keep the caller's order, which is preference
    // rank — a specialist before somebody merely covering.
    const candidates =
      demand.candidateTeachers.length > 0 ? [...demand.candidateTeachers] : [null];
    if (candidates.length > 1) {
      candidates.sort(
        (a, b) =>
          (ledger.teacherMinutes.get(a as string) ?? 0) -
          (ledger.teacherMinutes.get(b as string) ?? 0),
      );
    }

    let chosen: string | null = null;
    let best: { teacherId: string | null; placed: number } | null = null;

    for (const teacherId of candidates) {
      const { placed, journal } = placeDemand(
        demand,
        teacherId,
        input,
        runs,
        ledger,
        unavailable,
        labKinds,
        placements,
        random,
      );

      if (placed === demand.periods) {
        chosen = teacherId;
        best = null;
        break;
      }

      if (best === null || placed > best.placed) best = { teacherId, placed };
      undo(journal, placements);
    }

    // Nobody could take it whole. Replay whoever got furthest — the ledger is
    // back where it started, so the second run reproduces the first exactly.
    if (best !== null) {
      const { placed } = placeDemand(
        demand,
        best.teacherId,
        input,
        runs,
        ledger,
        unavailable,
        labKinds,
        placements,
        random,
      );
      chosen = best.teacherId;
      placedPeriods += placed;
      if (placed < demand.periods) {
        shortfalls.push({
          schoolClassId: demand.schoolClassId,
          subjectId: demand.subjectId,
          missing: demand.periods - placed,
        });
      }
    } else {
      placedPeriods += demand.periods;
    }

    // Only a teacher the generator *picked* is an affectation. One the school
    // had already named is not news.
    if (chosen && !demand.teacherWasAssigned) {
      assignments.push({
        schoolClassId: demand.schoolClassId,
        subjectId: demand.subjectId,
        classGroupId: demand.classGroupId,
        teacherId: chosen,
      });
    }
  }

  return {
    placements,
    shortfalls,
    assignments,
    placedPeriods,
    requestedPeriods,
  };
}

/**
 * Lays the week out several times and keeps the best attempt.
 *
 * "Best" is simply the one that placed the most periods, with fewer separate
 * shortfalls breaking a tie: a grid missing two hours of one subject is easier
 * to finish by hand than one missing an hour each of two.
 *
 * Deterministic in the seed, all the way down — the nth attempt uses
 * `seed + n`, so the same seed always yields the same grid. That is the whole
 * contract behind previewing before applying.
 */
export function generateTimetable(input: GeneratorInput): GeneratorResult {
  const attempts = Math.max(1, input.attempts ?? 8);

  let best: GeneratorResult | null = null;

  for (let index = 0; index < attempts; index += 1) {
    const result = attempt(input, (input.seed + index * 7919) >>> 0);

    if (
      best === null ||
      result.placedPeriods > best.placedPeriods ||
      (result.placedPeriods === best.placedPeriods &&
        result.shortfalls.length < best.shortfalls.length)
    ) {
      best = result;
    }

    // Nothing left to improve on.
    if (best.placedPeriods === best.requestedPeriods) break;
  }

  return (
    best ?? {
      placements: [],
      shortfalls: [],
      assignments: [],
      placedPeriods: 0,
      requestedPeriods: 0,
    }
  );
}
