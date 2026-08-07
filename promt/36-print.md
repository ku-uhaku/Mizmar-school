# 36 — Printing

**Prereqs:** 20, 21, 22, 23, 27.
**Owns no tables, no module.** **Route group:** `app/(print)/print/**`.

---

Moroccan schools run on paper. Every document below is signed, stamped and filed,
so this is a feature, not a nicety.

**`app/(print)/layout.tsx`** — its own root layout: no sidebar, no header, A4
geometry, `@page` margins, `print-color-adjust: exact`, and a screen preview that
looks exactly like the print. Every page here is server-rendered and
`requireAuth()`s with the permission of the data it shows.

**`lib/letterhead.ts`** — `letterheadFrom(ctx)` returning the school's logo,
name, address, Massar code and the organisation's legal identifiers. One source,
so all eight documents agree.

**The documents:**

| Route | Document |
|---|---|
| `print/payment/[paymentId]` | reçu — amount in figures **and in words** (fr + ar), tenders, allocated lines, signature block |
| `print/student/[studentId]/echeancier` | the year's fee schedule with what is paid and what remains |
| `print/student/[studentId]/attestation` | attestation de scolarité |
| `print/student/[studentId]/dashboard` | the pupil's full record |
| `print/class/[classId]` | class list — code, name, birth date, guardian, phone |
| `print/class/[classId]/timetable` | the class's week grid |
| `print/teacher/timetable` | one teacher's week |
| `print/caisse/session/[sessionId]` | the closing count sheet, for signature |

**Amount in words** in French and Arabic (`lib/amount-words.ts`) — a receipt
without it is not acceptable to a Moroccan accountant. Handle the awkward French
cases (quatre-vingts, cent, mille) and test them.

**Rules:** A4 portrait unless stated; page breaks never split a table row; the
letterhead repeats on every page and the page number reads "1 / 3"; Arabic
documents print RTL with the correct fonts embedded; nothing on paper is
`position: fixed`.

**Gate:** print all eight to PDF at A4 and show them to me. Then print a class
list of 45 pupils and confirm the header repeats, the numbering is right, and no
row is split across the break.
