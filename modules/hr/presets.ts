/**
 * The doublings a Moroccan school makes when it staffs its programme.
 *
 * Pure data — no `server-only`, no `db`, no React — because it has readers that
 * cannot share anything else: `prisma/seed.ts` sizes the demonstration staff
 * with it, and `scripts/staff-the-classes.ts` sizes a real school's from the
 * classes actually on file. It lived in the orchestrator, where the second
 * reader could not reach it without importing a script that seeds a database.
 *
 * It belongs to `hr` because `hr` owns `TeacherSubject` — what somebody *may* be
 * given, as against what they have been. See the note on that model.
 */

/**
 * The second subject a teacher of each subject may cover, best first.
 *
 * The doublings a Moroccan private school actually makes, not every pair that is
 * arithmetically possible: a professeur de maths covers physique-chimie and
 * l'informatique, an enseignant d'arabe takes l'éducation islamique and, in the
 * qualifying cycle, la philosophie — which is taught in Arabic. Nobody covers
 * l'EPS, which is why it has no entry.
 *
 * It is read in both directions on purpose. The small subjects — histoire-géo,
 * informatique, philosophie — are sized at one teacher, and appearing in a
 * bigger subject's list is what gives them a second qualified person without
 * inventing a post the programme does not pay for.
 *
 * This says what somebody *would* take, never that they all do: the caller picks
 * which of a subject's teachers actually gets a second qualification.
 */
export const SECOND_SUBJECTS: Record<string, string[]> = {
  AR: ["ISL", "PHILO"],
  FR: ["EN", "HG"],
  MATH: ["PC", "INFO"],
  PC: ["MATH", "SI"],
  SVT: ["PC", "AS"],
  ISL: ["AR"],
  EN: ["FR"],
  HG: ["ISL"],
  AMZ: ["AR"],
  INFO: ["MATH", "SI"],
  PHILO: ["HG"],
  // The primaire's own science and its dessin, and the filière SM-B's atelier.
  // Each is one post on its own, so the pairing is what gives it a second
  // qualified person: the SVT teacher takes activités scientifiques, and
  // sciences de l'ingénieur is covered by physique and by informatique.
  AS: ["SVT"],
  ART: ["EPS"],
  SI: ["PC", "INFO"],
  EPS: ["ART"],
};
