import type { Locale } from "@/lib/i18n/config";
import { formatDate, interpolate } from "@/lib/i18n/format";
import type { Dictionary } from "@/lib/i18n/types";
import type { BulletinDetail } from "@/modules/bulletins/queries";

/**
 * One bulletin, laid out for paper.
 *
 * Shared by the single print page and the class batch so the document a parent
 * is handed at a meeting and the one posted home are the same document. A
 * plain function of its props — no `"use client"`, no data access — because
 * both callers are Server Components and the only thing this decides is layout.
 *
 * Everything it prints is read off the row. Nothing is computed here, and that
 * is the point: a print page that worked out its own averages would be a third
 * opinion about what the school issued.
 */
export function BulletinBody({
  bulletin,
  locale,
  t,
}: {
  bulletin: BulletinDetail;
  locale: Locale;
  t: Dictionary;
}) {
  const mark = (value: number | null) =>
    value === null ? t.bulletin.noMark : value.toFixed(2);

  return (
    <>
      {/* ── Identité ───────────────────────────────────────────────────────── */}
      <table className="print-table mb-4">
        <tbody>
          <tr>
            <th scope="row">{t.bulletin.pupil}</th>
            <td>{bulletin.fullName}</td>
            <th scope="row">{t.student.birthDate}</th>
            <td>{formatDate(new Date(bulletin.birthDate), locale)}</td>
          </tr>
          <tr>
            <th scope="row">{t.bulletin.class}</th>
            <td>
              {bulletin.className ?? t.bulletin.noMark} — {bulletin.levelName}
            </td>
            <th scope="row">{t.bulletin.term}</th>
            <td>
              {bulletin.termName} — {bulletin.schoolYearName}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Les matières ───────────────────────────────────────────────────── */}
      <table className="print-table mb-4">
        <thead>
          <tr>
            <th>{t.bulletin.subject}</th>
            <th>{t.bulletin.coefficient}</th>
            <th>{t.bulletin.average}</th>
            <th>{t.bulletin.marks}</th>
            <th>{t.bulletin.rank}</th>
            <th>{t.bulletin.classAverage}</th>
            <th>{t.bulletin.appreciation}</th>
          </tr>
        </thead>
        <tbody>
          {bulletin.lines.map((line) => (
            <tr key={line.id}>
              <td>
                {/* Components are indented under their matière, exactly as the
                  screen shows them — see the note on BulletinLine. */}
                <span className={line.parentSubjectId !== null ? "ps-4" : ""}>
                  {line.subjectName}
                </span>
                {line.teacherName ? (
                  <span className="opacity-60"> · {line.teacherName}</span>
                ) : null}
              </td>
              <td className="tabular-nums">{line.coefficient}</td>
              <td className="tabular-nums font-medium">{mark(line.average)}</td>
              {/* "14,00 — on 3 marks". A 14 out of one paper and a 14 out of
                six are not the same claim, and the parent who asks "on what?"
                is answered on the document rather than at the desk. */}
              <td className="tabular-nums">{line.markCount}</td>
              <td className="tabular-nums">
                {line.rank ?? t.bulletin.noMark}
              </td>
              <td className="tabular-nums">{mark(line.classAverage)}</td>
              <td>{line.appreciation ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Le résultat ────────────────────────────────────────────────────── */}
      <table className="print-table mb-4">
        <tbody>
          <tr>
            <th scope="row">{t.bulletin.generalAverage}</th>
            <td className="tabular-nums font-medium">
              {mark(bulletin.generalAverage)}{" "}
              {interpolate(t.bulletin.outOf, { max: bulletin.outOf })}
            </td>
            <th scope="row">{t.bulletin.rank}</th>
            <td className="tabular-nums">
              {bulletin.rank === null
                ? t.bulletin.noMark
                : interpolate(t.bulletin.rankOf, {
                    rank: bulletin.rank,
                    size: bulletin.classSize,
                  })}
            </td>
          </tr>
          <tr>
            <th scope="row">{t.bulletin.classAverage}</th>
            <td className="tabular-nums">{mark(bulletin.classAverage)}</td>
            <th scope="row">
              {t.bulletin.classLowest} / {t.bulletin.classHighest}
            </th>
            <td className="tabular-nums">
              {mark(bulletin.classLowest)} — {mark(bulletin.classHighest)}
            </td>
          </tr>
          <tr>
            <th scope="row">{t.bulletin.attendance}</th>
            <td>
              {bulletin.absenceCount} {t.bulletin.absences}
              {bulletin.unjustifiedAbsenceCount > 0
                ? ` (${bulletin.unjustifiedAbsenceCount} ${t.bulletin.unjustifiedAbsences})`
                : ""}
              {" · "}
              {bulletin.lateCount} {t.bulletin.lates}
            </td>
            <th scope="row">{t.bulletin.yearAverage}</th>
            <td className="tabular-nums">{mark(bulletin.yearAverage)}</td>
          </tr>
          <tr>
            <th scope="row">{t.bulletin.mention}</th>
            <td>
              {bulletin.mention
                ? t.bulletinOptions.mentions[
                    bulletin.mention as keyof typeof t.bulletinOptions.mentions
                  ]
                : t.bulletin.noMention}
            </td>
            {/* The decision is printed only where it was asked — a blank
              "end-of-year decision" on a first-semester bulletin reads as an
              omission rather than as a question nobody put. */}
            {bulletin.decision ? (
              <>
                <th scope="row">{t.bulletin.decision}</th>
                <td>
                  {
                    t.bulletinOptions.decisions[
                      bulletin.decision as keyof typeof t.bulletinOptions.decisions
                    ]
                  }
                </td>
              </>
            ) : (
              <>
                <th scope="row" />
                <td />
              </>
            )}
          </tr>
        </tbody>
      </table>

      {/* ── Les observations ───────────────────────────────────────────────── */}
      {bulletin.mainTeacherComment ? (
        <section className="mb-3">
          <h2 className="mb-1 text-sm font-semibold">
            {t.bulletin.mainTeacherComment}
          </h2>
          <p className="text-xs">{bulletin.mainTeacherComment}</p>
        </section>
      ) : null}

      {bulletin.councilComment ? (
        <section className="mb-3">
          <h2 className="mb-1 text-sm font-semibold">
            {t.bulletin.councilComment}
          </h2>
          <p className="text-xs">{bulletin.councilComment}</p>
        </section>
      ) : null}
    </>
  );
}
