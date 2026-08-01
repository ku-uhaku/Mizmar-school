"use client";

import Link from "next/link";
import {
  DropletIcon,
  HeartPulseIcon,
  PhoneIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { useI18n } from "@/components/providers/i18n-provider";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatNumber, interpolate } from "@/lib/i18n/format";
import { ageFrom } from "@/lib/utils";
import type { StudentStatus } from "@/modules/students/enums";
import type { StudentDetail } from "@/modules/students/queries";

/**
 * The child at a glance, above the tabs.
 *
 * The file opens on the information tab, which is the edit form — a wall of
 * inputs that answers "what may I change about this pupil?" when the question
 * at the desk is "who is this, and who do I ring?". This band answers that one
 * without a tab being opened, and without repeating the form: it is the four
 * facts that are looked up rather than typed, plus the health flags.
 *
 * The health flags are the reason it is a band and not a line. An allergy
 * recorded on the fiche is worth nothing if it is three clicks inside a section
 * nobody opens; here it is on screen whenever the child is.
 */
export function StudentSummary({
  student,
  family,
}: {
  student: StudentDetail;
  family: { id: string; name: string; phone: string | null } | null;
}) {
  const { t, locale } = useI18n();
  const age = ageFrom(student.birthDate);

  const placement = [student.levelName, student.className]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="gap-0 py-0">
      <CardContent className="grid gap-x-6 gap-y-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label={t.student.age}>
          <p>
            {age !== null
              ? interpolate(t.student.ageYears, {
                  count: formatNumber(age, locale),
                })
              : t.common.notSet}
          </p>
          <Sub>
            {formatDate(student.birthDate, locale)}
            {student.birthCityName ? ` · ${student.birthCityName}` : ""}
          </Sub>
        </Fact>

        <Fact label={t.student.placement}>
          {placement ? (
            student.classId ? (
              <Link
                href={`/classes/${student.classId}`}
                className="hover:text-primary underline-offset-4 hover:underline"
              >
                {placement}
              </Link>
            ) : (
              <p>{placement}</p>
            )
          ) : (
            <p className="text-muted-foreground">{t.student.notPlaced}</p>
          )}
          <Sub>
            {t.studentOptions.statuses[student.status as StudentStatus]}
          </Sub>
        </Fact>

        <Fact label={t.student.family}>
          {family ? (
            <>
              <Link
                href={`/families/${family.id}`}
                className="hover:text-primary block truncate underline-offset-4 hover:underline"
              >
                {family.name}
              </Link>
              {/* A number you can ring from the screen: the commonest thing
                anyone does with a pupil's file is telephone the household. */}
              {family.phone ? (
                <a
                  href={`tel:${family.phone}`}
                  dir="ltr"
                  className="text-muted-foreground hover:text-foreground mt-0.5 flex items-center gap-1 text-xs"
                >
                  <PhoneIcon className="size-3" />
                  {family.phone}
                </a>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground">{t.student.noFamily}</p>
          )}
        </Fact>

        <Fact label={t.student.code}>
          <p dir="ltr" className="truncate tabular-nums">
            {student.code}
          </p>
          <Sub>
            {student.massarCode
              ? `${t.student.massarCode} ${student.massarCode}`
              : t.common.notSet}
          </Sub>
        </Fact>
      </CardContent>

      <HealthStrip student={student} />
    </Card>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 text-sm">
      <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <div className="min-w-0 font-medium">{children}</div>
    </div>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground truncate text-xs font-normal">
      {children}
    </p>
  );
}

/**
 * Only rendered when there is something to say. An empty health strip on every
 * healthy child would train the eye to skip the row that matters.
 */
function HealthStrip({ student }: { student: StudentDetail }) {
  const { t } = useI18n();

  const flags: { label: string; value: string; icon: React.ReactNode }[] = [];

  if (student.allergies) {
    flags.push({
      label: t.student.allergies,
      value: student.allergies,
      icon: <TriangleAlertIcon className="size-3.5" />,
    });
  }
  if (student.chronicCondition) {
    flags.push({
      label: t.student.chronicCondition,
      value: student.chronicCondition,
      icon: <HeartPulseIcon className="size-3.5" />,
    });
  }
  if (student.medications) {
    flags.push({
      label: t.student.medications,
      value: student.medications,
      icon: <HeartPulseIcon className="size-3.5" />,
    });
  }
  if (student.hasDisability) {
    flags.push({
      label: t.student.hasDisability,
      value: t.common.yes,
      icon: <TriangleAlertIcon className="size-3.5" />,
    });
  }

  if (flags.length === 0 && !student.bloodType) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
      <span className="text-muted-foreground me-1 text-xs font-medium tracking-wide uppercase">
        {t.student.medical}
      </span>

      {student.bloodType ? (
        <span className="bg-muted flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium">
          <DropletIcon className="size-3.5" />
          <span dir="ltr">{student.bloodType}</span>
        </span>
      ) : null}

      {flags.map((flag) => (
        <span
          key={flag.label}
          // The full text is on the title: a chip that wrapped a paragraph of
          // dosage instructions would push the tabs off the screen.
          title={`${flag.label} — ${flag.value}`}
          className="border-warning/40 bg-warning/10 text-warning flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium"
        >
          {flag.icon}
          <span className="shrink-0">{flag.label}</span>
          <span className="truncate opacity-80">{flag.value}</span>
        </span>
      ))}
    </div>
  );
}
