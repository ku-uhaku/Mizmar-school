import {
  cashImpactOf,
  documentCode,
  expectedDrawerTotal,
  openSessionKey,
  summariseMethod,
  sumCentimes,
} from "@/modules/treasury/enums";
import {
  BANK_SEEDS,
  CATEGORY_SEEDS,
  MOTIF_SEEDS,
  REGISTER_SEEDS,
  SUPPLIER_SEEDS,
  type RegisterSeed,
} from "@/modules/treasury/presets";
import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * The caisse written for one school — its tills, rubriques, sous-rubriques,
 * fournisseurs, motifs and banks. The lists themselves are presets.ts.
 *
 * `seedTreasury` is the configuration alone. The money itself is `seedPayments`
 * below, and it is a separate call on purpose — a school restoring this schema
 * wants the rubriques and not the receipts.
 *
 * Idempotent — upserted on `(schoolId, code)`, so re-running changes nothing.
 */

export async function seedTreasury(
  db: SeedDb,
  schoolId: string,
): Promise<{ registerIdByCode: Record<string, string> }> {
  const registerIdByCode: Record<string, string> = {};

  /*
    One drawer per cashier, plus the shared coffre.

    Generated from who may actually take money rather than written down: a
    school that hires a second secretary should get a second till without anyone
    editing this file, and a seeded caisse everybody shares is precisely the
    arrangement the holder rule exists to end. Whoever holds
    TREASURY_COLLECT at this school gets a till named after them.
  */
  const cashiers = await db.user.findMany({
    where: {
      isActive: true,
      memberships: {
        some: {
          schoolId,
          role: { permissions: { some: { permission: { code: "treasury.collect" } } } },
        },
      },
    },
    orderBy: { username: "asc" },
    select: {
      id: true,
      username: true,
      profile: { select: { firstName: true, lastName: true } },
    },
  });

  const perHolder: (RegisterSeed & { holderId: string })[] = cashiers.map(
    (cashier, index) => {
      const name = cashier.profile
        ? `${cashier.profile.firstName} ${cashier.profile.lastName}`.trim()
        : cashier.username;
      return {
        // Keyed on the account rather than on the name: two colleagues may share
        // a surname, and a code has to stay unique and stable. The username, not
        // the address — see User.email.
        code: `CAISSE-${cashier.username.toUpperCase()}`,
        name: `Caisse ${name}`,
        nameAr: `صندوق ${name}`,
        position: 10 + index,
        holderId: cashier.id,
      };
    },
  );

  const allRegisters: (RegisterSeed & { holderId?: string })[] = [
    ...REGISTER_SEEDS,
    ...perHolder,
  ];

  for (const register of allRegisters) {
    const row = await db.cashRegister.upsert({
      where: { schoolId_code: { schoolId, code: register.code } },
      update: {
        name: register.name,
        nameAr: register.nameAr,
        position: register.position,
        holderId: register.holderId ?? null,
      },
      create: {
        schoolId,
        code: register.code,
        name: register.name,
        nameAr: register.nameAr,
        position: register.position,
        holderId: register.holderId ?? null,
      },
      select: { id: true },
    });
    registerIdByCode[register.code] = row.id;
  }

  // Rubriques and their sub-rubriques. Upserted on the same [schoolId, code]
  // the old expense categories used, so a re-seed after the data migration
  // updates those rows rather than adding a second set beside them.
  const categoryIdByCode: Record<string, string> = {};
  /** Keyed `RUBRIQUE:SOUS-RUBRIQUE` — sub-codes are only unique within a parent. */
  const subcategoryIdByCode: Record<string, string> = {};

  for (const category of CATEGORY_SEEDS) {
    const row = await db.operationCategory.upsert({
      where: { schoolId_code: { schoolId, code: category.code } },
      update: {
        name: category.name,
        nameAr: category.nameAr,
        kind: category.kind,
        position: category.position,
      },
      create: {
        schoolId,
        code: category.code,
        name: category.name,
        nameAr: category.nameAr,
        kind: category.kind,
        position: category.position,
      },
      select: { id: true },
    });
    categoryIdByCode[category.code] = row.id;

    for (const [index, sub] of (category.subcategories ?? []).entries()) {
      const subRow = await db.operationSubcategory.upsert({
        where: {
          categoryId_code: { categoryId: row.id, code: sub.code },
        },
        update: { name: sub.name, nameAr: sub.nameAr, position: index + 1 },
        create: {
          categoryId: row.id,
          code: sub.code,
          name: sub.name,
          nameAr: sub.nameAr,
          position: index + 1,
        },
        select: { id: true },
      });
      subcategoryIdByCode[`${category.code}:${sub.code}`] = subRow.id;
    }
  }

  /*
    Les fournisseurs, each pointing at the rubrique its payments post under.

    That link is the whole reason the factures and achats screens are one
    select: without it the manager would still be choosing a rubrique for the
    water bill every single month.
  */
  for (const supplier of SUPPLIER_SEEDS) {
    const data = {
      name: supplier.name,
      nameAr: supplier.nameAr,
      kind: supplier.kind,
      defaultCategoryId: supplier.categoryCode
        ? (categoryIdByCode[supplier.categoryCode] ?? null)
        : null,
      defaultSubcategoryId:
        supplier.categoryCode && supplier.subcategoryCode
          ? (subcategoryIdByCode[
              `${supplier.categoryCode}:${supplier.subcategoryCode}`
            ] ?? null)
          : null,
      accountRef: supplier.accountRef ?? null,
      position: supplier.position,
    };

    await db.supplier.upsert({
      where: { schoolId_code: { schoolId, code: supplier.code } },
      // `isActive` is deliberately absent: a supplier the school stopped using
      // stays retired through a re-seed.
      update: data,
      create: { schoolId, code: supplier.code, ...data },
    });
  }

  for (const motif of MOTIF_SEEDS) {
    const categoryId = motif.categoryCode
      ? (categoryIdByCode[motif.categoryCode] ?? null)
      : null;
    await db.operationMotif.upsert({
      where: { schoolId_code: { schoolId, code: motif.code } },
      update: {
        name: motif.name,
        nameAr: motif.nameAr,
        categoryId,
        position: motif.position,
      },
      create: {
        schoolId,
        code: motif.code,
        name: motif.name,
        nameAr: motif.nameAr,
        categoryId,
        position: motif.position,
      },
    });
  }

  for (const bank of BANK_SEEDS) {
    await db.bank.upsert({
      where: { schoolId_code: { schoolId, code: bank.code } },
      update: { name: bank.name, nameAr: bank.nameAr, position: bank.position },
      create: {
        schoolId,
        code: bank.code,
        name: bank.name,
        nameAr: bank.nameAr,
        position: bank.position,
      },
    });
  }

  log(
    "caisse",
    `${allRegisters.length} tills (${perHolder.length} held), ` +
      `${CATEGORY_SEEDS.length} rubriques, ${SUPPLIER_SEEDS.length} fournisseurs, ` +
      `${MOTIF_SEEDS.length} motifs, ${BANK_SEEDS.length} banks`,
  );

  return { registerIdByCode };
}


// ── The money ────────────────────────────────────────────────────────────────

/**
 * Receipts against the year's schedule, and the sessions they were taken in.
 *
 * ── Why this is seeded at all ───────────────────────────────────────────────
 * It was not, at first: a receipt is money somebody took, and inventing one
 * puts a figure in the ledger that never happened. What changed the balance is
 * the reporting module — two dozen finance reports whose every column reads
 * off payments, allocations, tenders, cheques and sessions. With an empty
 * ledger they are not "correct and empty", they are untestable, and a screen
 * nobody can see working is a screen nobody trusts.
 *
 * ── It obeys the same invariants the service does ───────────────────────────
 * Tenders total to allocations; no allocation exceeds what its line still
 * owes; every receipt carries the mirror `CashOperation` that makes the drawer
 * reconcile, with `cashImpactOf` deciding what actually moved cash. Written
 * against the same helpers `recordPayment` uses rather than beside them — a
 * seed that balanced by its own arithmetic would drift from the app's the first
 * time either changed.
 *
 * ── Deterministic, so re-running is a no-op ─────────────────────────────────
 * Which households pay, how much and by what means all come from a hash of the
 * family code, and the receipt number is derived rather than counted, so the
 * same run produces the same `(schoolId, code)` and the upsert has nothing to
 * do. A receipt already on file is left exactly as it is: re-creating its
 * allocations would double every family's paid balance.
 */
export async function seedPayments(
  db: SeedDb,
  {
    schoolId,
    schoolYearId,
    variant,
  }: { schoolId: string; schoolYearId: string; variant: number },
): Promise<void> {
  const register = await db.cashRegister.findFirst({
    where: { schoolId, isActive: true, holderId: { not: null } },
    orderBy: { position: "asc" },
    select: { id: true, holderId: true },
  });
  if (!register?.holderId) return;

  const cashierId = register.holderId;
  const banks = await db.bank.findMany({
    where: { schoolId },
    orderBy: { position: "asc" },
    select: { id: true, name: true },
  });

  const families = await db.family.findMany({
    where: {
      schoolId,
      children: { some: { enrollments: { some: { schoolYearId } } } },
    },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      children: {
        select: {
          enrollments: {
            where: { schoolYearId },
            select: {
              fees: {
                where: { status: "DUE" },
                orderBy: { dueDate: "asc" },
                select: {
                  id: true,
                  dueDate: true,
                  dueMonth: true,
                  dueYear: true,
                  amountCentimes: true,
                  allocations: { select: { amountCentimes: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  /** A small stable hash of the family code — the only source of variation. */
  const hash = (code: string) => {
    let value = variant * 7919 + 17;
    for (const character of code) value = (value * 31 + character.charCodeAt(0)) % 100_003;
    return value;
  };

  const sessionByMonth = new Map<string, string>();
  let sequence = 0;
  let written = 0;
  let receipts = 0;

  for (const family of families) {
    const lines = family.children
      .flatMap((child) => child.enrollments.flatMap((enrolment) => enrolment.fees))
      .sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime());
    if (lines.length === 0) continue;

    const bucket = hash(family.code) % 10;
    /*
      Four kinds of household, in the proportions a Moroccan private school
      actually sees: most up to date, a long tail behind, and a few who have
      paid nothing at all. Anything more uniform would make the arrears reports
      look either empty or catastrophic, and neither is worth testing against.
    */
    const share = bucket <= 3 ? 1 : bucket <= 6 ? 0.6 : bucket <= 8 ? 0.25 : 0;
    const paidLines = lines.slice(0, Math.round(lines.length * share));
    if (paidLines.length === 0) continue;

    // One receipt per month settled: a family pays when the instalment falls,
    // not once for the year, and the monthly relevés need that shape to mean
    // anything.
    const byMonth = new Map<string, typeof paidLines>();
    for (const line of paidLines) {
      const key = `${line.dueYear}-${String(line.dueMonth).padStart(2, "0")}`;
      byMonth.set(key, [...(byMonth.get(key) ?? []), line]);
    }

    for (const [monthKey, monthLines] of [...byMonth.entries()].sort()) {
      sequence += 1;

      const allocations = monthLines
        .map((line) => ({
          enrollmentFeeId: line.id,
          // Never more than the line still owes — the invariant `recordPayment`
          // enforces, and the reason a re-run cannot inflate a balance.
          amountCentimes:
            line.amountCentimes -
            sumCentimes(line.allocations.map((allocation) => allocation.amountCentimes)),
        }))
        .filter((allocation) => allocation.amountCentimes > 0);
      if (allocations.length === 0) continue;

      const total = sumCentimes(allocations.map((allocation) => allocation.amountCentimes));
      // A few days after the échéance: families pay late, and a statement where
      // every receipt lands on the 1st tests nothing about date ranges.
      const dueDate = monthLines[0].dueDate;
      const paidAt = new Date(dueDate);
      paidAt.setDate(paidAt.getDate() + ((hash(family.code + monthKey) % 12) + 1));

      const paidYear = paidAt.getFullYear();
      const code = documentCode("R", paidYear, sequence);

      const existing = await db.payment.findFirst({
        where: { schoolId, code },
        select: { id: true },
      });
      if (existing) {
        receipts += 1;
        continue;
      }

      const spin = hash(family.code + monthKey) % 20;
      const method = spin < 12 ? "CASH" : spin < 17 ? "CHEQUE" : "BANK_TRANSFER";
      const bank = banks.length > 0 ? banks[spin % banks.length] : null;

      /*
        Only cash belongs to a session: a cheque sits in the safe and a virement
        never comes near the desk, so neither may move the figure the cashier is
        asked to count. Same rule as `cashImpactOf`, applied one level up.
      */
      let cashSessionId: string | null = null;
      if (method === "CASH") {
        cashSessionId = sessionByMonth.get(monthKey) ?? null;
        if (!cashSessionId) {
          const opened = new Date(paidYear, paidAt.getMonth(), 1, 8, 30);
          const session = await db.cashSession.create({
            data: {
              cashRegisterId: register.id,
              openedById: cashierId,
              openedAt: opened,
              openingFloatCentimes: 20_000,
              status: "CLOSED",
              closedById: cashierId,
              closedAt: new Date(paidYear, paidAt.getMonth() + 1, 0, 18, 0),
              // Filled in once the month's takings are known — see below.
              openKey: openSessionKey(register.id, "CLOSED"),
            },
            select: { id: true },
          });
          cashSessionId = session.id;
          sessionByMonth.set(monthKey, session.id);
        }
      }

      await db.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            schoolId,
            schoolYearId,
            familyId: family.id,
            code,
            paidAt,
            totalCentimes: total,
            status: "POSTED",
            cashSessionId,
            createdById: cashierId,
            allocations: { create: allocations },
          },
          select: { id: true },
        });

        const cheque =
          method === "CHEQUE"
            ? await tx.cheque.create({
                data: {
                  schoolId,
                  direction: "INCOMING",
                  number: String(1_000_000 + sequence * 7 + variant * 100_000),
                  bankId: bank?.id ?? null,
                  bankName: bank?.name ?? null,
                  drawerName: family.name,
                  amountCentimes: total,
                  issuedOn: paidAt,
                  dueOn: new Date(paidAt.getTime() + 30 * 24 * 60 * 60 * 1000),
                  // Spread across the life of a cheque so the suivi screen and
                  // the report by état both have every state to show.
                  status: CHEQUE_SPIN[spin % CHEQUE_SPIN.length],
                },
                select: { id: true },
              })
            : null;

        await tx.paymentTender.create({
          data: {
            paymentId: payment.id,
            method,
            amountCentimes: total,
            // Cash is the only tender with no bank behind it.
            bankId: method === "CASH" ? null : (bank?.id ?? null),
            bankName: method === "CASH" ? null : (bank?.name ?? null),
            chequeId: cheque?.id ?? null,
          },
        });

        const summarised = summariseMethod([method]);
        await tx.cashOperation.create({
          data: {
            schoolId,
            cashSessionId,
            kind: "ENCAISSEMENT",
            method: summarised,
            amountCentimes: total,
            cashImpactCentimes: cashImpactOf(
              "ENCAISSEMENT",
              summarised,
              method === "CASH" ? total : 0,
            ),
            label: code,
            reference: code,
            occurredAt: paidAt,
            status: "POSTED",
            paymentId: payment.id,
            createdById: cashierId,
          },
        });
      });

      written += 1;
      receipts += 1;
    }
  }

  /*
    The counted drawer, once the month's takings are in.

    Written from the operations rather than from a running total kept above,
    because that is how `closeSession` derives it — a seed that computed the
    expected figure its own way would reconcile against numbers the app would
    not.
  */
  for (const sessionId of sessionByMonth.values()) {
    const session = await db.cashSession.findUnique({
      where: { id: sessionId },
      select: {
        openingFloatCentimes: true,
        operations: {
          where: { status: "POSTED" },
          select: { cashImpactCentimes: true },
        },
      },
    });
    if (!session) continue;

    const expected = expectedDrawerTotal(
      session.openingFloatCentimes,
      session.operations.map((operation) => operation.cashImpactCentimes),
    );
    // One session short by a few dirhams: a relevé de caisse where every écart
    // is zero never exercises the column that matters.
    const counted = sessionId.charCodeAt(1) % 7 === 0 ? expected - 3_500 : expected;

    await db.cashSession.update({
      where: { id: sessionId },
      data: {
        expectedCentimes: expected,
        countedCentimes: counted,
        varianceCentimes: counted - expected,
      },
    });
  }

  /*
    A few receipts voided.

    Mirrors `cancelPayment` exactly, including the part that reads oddly: the
    original operation stays POSTED and a reversing one is added beside it. The
    money really did come in that day, so striking the original out *and*
    posting a mirror would take it off the drawer twice. Only the payment's
    status moves, and that is what every "how much has been paid" sum filters
    on — which is how the charges go back on the family without a ledger line
    being rewritten.
  */
  const cancellable = await db.payment.findMany({
    where: { schoolId, schoolYearId, status: "POSTED" },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      totalCentimes: true,
      operation: { select: { id: true, method: true, cashImpactCentimes: true } },
    },
  });

  // Keyed to the receipt number rather than to its position, for the same
  // reason the annulations above are — see the note there.
  const voided = cancellable.filter(
    (payment) => Number(payment.code.slice(-4)) % 97 === 0,
  );
  for (const payment of voided) {
    const cancelledAt = new Date();
    await db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "CANCELLED",
          cancelledAt,
          cancelReason: "Erreur de saisie — reçu refait",
        },
      });

      if (payment.operation) {
        await tx.cashOperation.create({
          data: {
            schoolId,
            kind: "ENCAISSEMENT",
            method: payment.operation.method,
            amountCentimes: payment.totalCentimes,
            cashImpactCentimes: -payment.operation.cashImpactCentimes,
            label: payment.code,
            reference: payment.code,
            occurredAt: cancelledAt,
            status: "POSTED",
            reversesOperationId: payment.operation.id,
            createdById: cashierId,
          },
        });
      }

      // A cheque that paid a cancelled receipt is handed back, not banked.
      await tx.cheque.updateMany({
        where: {
          tender: { paymentId: payment.id },
          status: { in: ["PENDING", "DEPOSITED"] },
        },
        data: { status: "RETURNED", settledOn: cancelledAt },
      });
    });
  }

  log(
    "règlements",
    `${receipts} receipts (${written} written), ${sessionByMonth.size} sessions, ` +
      `${voided.length} annulés`,
  );
}

/** The states a seeded cheque may be in, in the proportion a safe holds them. */
const CHEQUE_SPIN = [
  "CASHED",
  "CASHED",
  "DEPOSITED",
  "PENDING",
  "PENDING",
  "BOUNCED",
] as const;
