import { defineModule } from "@/lib/module";
import { BULLETIN_PERMISSIONS } from "@/modules/bulletins/permissions";

/**
 * Les bulletins: what a term's marks add up to, frozen and handed out.
 *
 * ── Why this is not part of assessments ─────────────────────────────────────
 * That module owns the marks. This one owns a *document* made from them, and
 * the two have opposite obligations: a mark sheet must always show the latest
 * correction, while a bulletin must always show what the school issued. Putting
 * both behind one table would mean picking which of those two promises to break.
 *
 * So the marks stay where they are and are read through the assessments
 * module's own queries; nothing here writes an AssessmentGrade, and nothing
 * there reads a Bulletin. What this module adds is the arithmetic a mark sheet
 * cannot do on its own — a subject's average across a term, a matière's mark
 * from its components, a rank within the class, the class's own spread — and
 * the decision that turns those into a document somebody signs.
 *
 * ── What it does not own ────────────────────────────────────────────────────
 * Coefficients (LevelSubject), the scale and the pass ratio (SchoolSettings),
 * the terms (school-years) and the register (classroom). All of it is read, and
 * all of it is *copied onto* the bulletin at computation rather than joined at
 * read time — see the note on BulletinLine.
 */
export const bulletinsModule = defineModule({
  id: "bulletins",
  schemaFolder: "bulletins",
  nav: [
    {
      href: "/bulletins",
      icon: "bulletins",
      section: "vieScolaire",
      labelKey: "bulletins",
      // After the contrôles and the ministry's file, because it is the end of
      // that chain: marks are set, marked, reconciled, and then add up to this.
      order: 47,
      schoolPermission: BULLETIN_PERMISSIONS.BULLETIN_VIEW,
    },
  ],
  permissions: [
    { group: "bulletin", codes: Object.values(BULLETIN_PERMISSIONS) },
  ],
});
