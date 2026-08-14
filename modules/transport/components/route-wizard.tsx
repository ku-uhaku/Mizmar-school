"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { useActionState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Combobox } from "@/components/form/combobox";
import { FormField } from "@/components/form/form-field";
import { FormGrid } from "@/components/form/form-page";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { IDLE, type ActionStateWith } from "@/lib/action-state";
import { valueOf } from "@/lib/form-values";
import { interpolate } from "@/lib/i18n/format";
import { openRouteAction } from "@/modules/transport/actions";
import { TRANSPORT_DIRECTIONS } from "@/modules/transport/enums";
import type { SubscribableStudent } from "@/modules/transport/queries";

const STEPS = ["route", "schedules", "neighbourhoods", "riders"] as const;
type Step = (typeof STEPS)[number];

const NO_SELECTION = "__none__";

type Option = { id: string; label: string };
type ScheduleOption = Option & { name: string; direction: string };

/** A passenger being seated, named by the quartier they live in. */
type RiderDraft = {
  enrollmentId: string;
  neighbourhoodId: string;
  scheduleIds: string[];
  direction: string;
};

/**
 * Draws a line in one sitting: the line, its runs, its quartiers, and the
 * children living in them.
 *
 * ── What it does not ask ────────────────────────────────────────────────────
 * Stops. A line is drawn for a set of quartiers, and the quartier is the kerb —
 * one stop is derived per quartier served, in the order they were ticked. Where
 * the bus actually pulls in and at what minute is a refinement, and it belongs
 * on the line's own page once the line exists. Asking for it first is what made
 * drawing a circuit a twenty-field job before anybody could board it.
 *
 * ── Why the passengers follow from the quartiers ────────────────────────────
 * `Student.neighbourhoodId` is every pupil's address, taken at admission
 * whether or not they ride. So once the catchment is ticked, the families the
 * line exists to collect are already known — the step lists them under their
 * quartier rather than making a secretary search five hundred names for the
 * ones that happen to live on the route.
 *
 * Like the enrolment wizard, every step stays mounted and only its visibility
 * toggles, so nothing chosen on step one is lost by walking to step four, and
 * the submit carries the lot.
 */
export function RouteWizard({
  vehicles,
  schedules,
  neighbourhoods,
  subscribable,
  canSubscribe,
}: {
  vehicles: { id: string; label: string; seatCount: number }[];
  schedules: ScheduleOption[];
  neighbourhoods: Option[];
  subscribable: SubscribableStudent[];
  canSubscribe: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [state, formAction] = useActionState<
    ActionStateWith<{ routeId: string }>,
    FormData
  >(openRouteAction, IDLE);
  // The toast carries the outcome — including the riders the bus refused — so
  // it is raised before the line's own page replaces this one.
  useActionFeedback(state, {
    onSuccess: () => {
      if (state.data) router.push(`/transport/routes/${state.data.routeId}`);
    },
  });
  const errors = state.fieldErrors ?? {};

  const [step, setStep] = React.useState<Step>("route");

  const [code, setCode] = React.useState(valueOf(state, "code", null) || "");
  const [name, setName] = React.useState(valueOf(state, "name", null) || "");
  const [vehicleId, setVehicleId] = React.useState(NO_SELECTION);
  const [capacity, setCapacity] = React.useState("");

  const [scheduleIds, setScheduleIds] = React.useState<string[]>([]);
  const [neighbourhoodIds, setNeighbourhoodIds] = React.useState<string[]>([]);
  const [riders, setRiders] = React.useState<RiderDraft[]>([]);

  const [search, setSearch] = React.useState("");
  /*
    Subscribers first, and by default.

    A line is drawn for the families who asked for the bus, so a passenger list
    of every child in the quartier buries the twelve that matter under two
    hundred that do not. The switch is there because the filter is a default and
    not a rule: a school that has not declared a transport charge at all has
    nobody ticked, and seating a child who never opted in is allowed — it raises
    the charge rather than letting them ride free, which is what
    `syncTransportOption` exists for.
  */
  const [transportOnly, setTransportOnly] = React.useState(true);

  /*
    Only the steps that have something to offer. A school that has declared no
    horaire and no quartier — which is every school before Configuration is
    filled in — would otherwise be walked through two screens saying "nothing
    here", and the point of the wizard is that it asks only what it needs.
  */
  const visibleSteps = STEPS.filter((candidate) => {
    if (candidate === "schedules") return schedules.length > 0;
    if (candidate === "neighbourhoods") return neighbourhoods.length > 0;
    if (candidate === "riders") return canSubscribe && neighbourhoods.length > 0;
    return true;
  });
  const stepIndex = visibleSteps.indexOf(step);

  // Only the runs this line makes are offered to its passengers — putting a
  // child on a departure the circuit does not run is what step two prevents.
  const chosenSchedules = schedules.filter((schedule) =>
    scheduleIds.includes(schedule.id),
  );

  /*
    What the line offers, by the same rule `seatsOnRoute` applies on the server:
    the cap typed here if there is one, else the bus's own count, else nothing.

    Nothing, not unlimited — and the passenger step reads it. A line with no bus
    and no cap has no seats, so every rider ticked onto it would be refused FULL
    on submit and the toast would be the first anybody heard of it.
  */
  const typedCapacity = capacity.trim() === "" ? null : Number(capacity);
  const seats =
    typedCapacity !== null && Number.isFinite(typedCapacity)
      ? typedCapacity
      : (vehicles.find((vehicle) => vehicle.id === vehicleId)?.seatCount ?? 0);

  const canLeaveRoute = code.trim() !== "" && name.trim() !== "";

  /*
    The catchment, in the order it was ticked, each with the pupils living in
    it. That order is the order the bus takes the quartiers in, so it is also
    the order the stops are numbered — the list on screen is the itinerary.
  */
  const needle = search.trim().toLocaleLowerCase();

  const served = neighbourhoodIds
    .map((id) => neighbourhoods.find((option) => option.id === id))
    .filter((option): option is Option => Boolean(option))
    .map((option) => ({
      ...option,
      residents: subscribable.filter(
        (student) =>
          student.neighbourhoodId === option.id &&
          (!transportOnly || student.usesTransport) &&
          // The label carries the name, the matricule and the class, which is
          // every handle a secretary has on a child at this moment.
          (needle === "" ||
            student.label.toLocaleLowerCase().includes(needle)),
      ),
    }));

  function toggleNeighbourhood(id: string, checked: boolean) {
    setNeighbourhoodIds((current) =>
      checked ? [...current, id] : current.filter((one) => one !== id),
    );
    // A quartier dropped from the line takes its passengers with it: there is
    // no longer a kerb for them to board at.
    if (!checked) {
      setRiders((current) =>
        current.filter((rider) => rider.neighbourhoodId !== id),
      );
    }
  }

  function toggleRider(student: SubscribableStudent, checked: boolean) {
    setRiders((current) => {
      if (!checked) {
        return current.filter(
          (rider) => rider.enrollmentId !== student.enrollmentId,
        );
      }
      if (current.some((rider) => rider.enrollmentId === student.enrollmentId)) {
        return current;
      }
      return [
        ...current,
        {
          enrollmentId: student.enrollmentId,
          neighbourhoodId: student.neighbourhoodId ?? "",
          // Every run the line makes, which is the arrangement most families
          // take: collected in the morning, taken home in the evening.
          scheduleIds: chosenSchedules.map((schedule) => schedule.id),
          direction: "BOTH",
        },
      ];
    });
  }

  function patchRider(enrollmentId: string, patch: Partial<RiderDraft>) {
    setRiders((current) =>
      current.map((rider) =>
        rider.enrollmentId === enrollmentId ? { ...rider, ...patch } : rider,
      ),
    );
  }

  const seated = new Set(riders.map((rider) => rider.enrollmentId));

  return (
    <form
      action={formAction}
      // Enter advances; it must never submit a half-drawn line from step one,
      // where the final step's submit button is the first one in tree order.
      onKeyDown={(event) => {
        if (event.key === "Enter" && step !== visibleSteps.at(-1)) {
          event.preventDefault();
        }
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>{t.transport.wizard.title}</CardTitle>
          <CardDescription>{t.transport.wizard.subtitle}</CardDescription>
          <div className="mt-2 flex items-center gap-1.5">
            {visibleSteps.map((visible, index) => (
              <span
                key={visible}
                aria-hidden
                className={
                  index <= stepIndex
                    ? "bg-primary h-1 flex-1 rounded-full"
                    : "bg-muted h-1 flex-1 rounded-full"
                }
              />
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            {interpolate(t.transport.wizard.stepOf, {
              step: stepIndex + 1,
              total: visibleSteps.length,
            })}
          </p>
        </CardHeader>

        <CardContent className="grid gap-5">
          {/* ── La ligne ─────────────────────────────────────────────────── */}
          <div className={step === "route" ? "grid gap-5" : "hidden"}>
            <FormGrid cols={2}>
              <FormField
                name="code"
                label={t.transport.routeCode}
                hint={t.transport.wizard.codeHint}
                error={errors.code}
                required
              >
                <Input
                  id="code"
                  name="code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  required
                />
              </FormField>

              <FormField
                name="name"
                label={t.transport.routeName}
                error={errors.name}
                required
              >
                <Input
                  id="name"
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </FormField>

              <FormField name="direction" label={t.transport.direction}>
                <Select name="direction" defaultValue="BOTH">
                  <SelectTrigger id="direction" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSPORT_DIRECTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t.transportOptions.directions[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField
                name="vehicleId"
                label={t.transport.assignedVehicle}
                hint={
                  seats === 0
                    ? t.transport.wizard.noVehicleHint
                    : interpolate(t.transport.wizard.vehicleSeats, {
                        count: seats,
                      })
                }
              >
                <Combobox
                  id="vehicleId"
                  name="vehicleId"
                  value={vehicleId}
                  onValueChange={setVehicleId}
                  emptyOption={{
                    value: NO_SELECTION,
                    label: t.transport.noVehicleAssigned,
                  }}
                  options={vehicles.map((vehicle) => ({
                    value: vehicle.id,
                    label: `${vehicle.label} (${vehicle.seatCount})`,
                  }))}
                />
              </FormField>

              <FormField
                name="capacity"
                label={t.transport.capacity}
                hint={t.transport.capacityHint}
                error={errors.capacity}
              >
                <Input
                  id="capacity"
                  name="capacity"
                  type="number"
                  min="0"
                  dir="ltr"
                  value={capacity}
                  onChange={(event) => setCapacity(event.target.value)}
                />
              </FormField>
            </FormGrid>

            <FormField name="notes" label={t.transport.riderNotes}>
              <Textarea id="notes" name="notes" rows={2} />
            </FormField>
          </div>

          {/* ── Les horaires ─────────────────────────────────────────────── */}
          <div className={step === "schedules" ? "grid gap-4" : "hidden"}>
            <p className="text-muted-foreground text-sm">
              {t.transport.routeSchedulesHint}
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {schedules.map((schedule) => {
                const checked = scheduleIds.includes(schedule.id);
                return (
                  <label
                    key={schedule.id}
                    htmlFor={`schedule-${schedule.id}`}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                  >
                    <Checkbox
                      id={`schedule-${schedule.id}`}
                      checked={checked}
                      onCheckedChange={(value) => {
                        setScheduleIds((current) =>
                          value === true
                            ? [...current, schedule.id]
                            : current.filter((one) => one !== schedule.id),
                        );
                        // A run dropped from the line cannot stay on the
                        // passengers it was chosen for.
                        if (value !== true) {
                          setRiders((current) =>
                            current.map((rider) => ({
                              ...rider,
                              scheduleIds: rider.scheduleIds.filter(
                                (one) => one !== schedule.id,
                              ),
                            })),
                          );
                        }
                      }}
                    />
                    <span className="min-w-0 truncate">
                      {schedule.label} · {schedule.name}
                    </span>
                    {checked ? (
                      <input
                        type="hidden"
                        name="scheduleIds"
                        value={schedule.id}
                      />
                    ) : null}
                  </label>
                );
              })}
            </div>
          </div>

          {/* ── Les quartiers ────────────────────────────────────────────── */}
          <div className={step === "neighbourhoods" ? "grid gap-4" : "hidden"}>
            <p className="text-muted-foreground text-sm">
              {t.transport.wizard.neighbourhoodsHint}
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {neighbourhoods.map((neighbourhood) => {
                const checked = neighbourhoodIds.includes(neighbourhood.id);
                const residents = subscribable.filter(
                  (student) => student.neighbourhoodId === neighbourhood.id,
                ).length;

                return (
                  <label
                    key={neighbourhood.id}
                    htmlFor={`neighbourhood-${neighbourhood.id}`}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                  >
                    <Checkbox
                      id={`neighbourhood-${neighbourhood.id}`}
                      checked={checked}
                      onCheckedChange={(value) =>
                        toggleNeighbourhood(neighbourhood.id, value === true)
                      }
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {neighbourhood.label}
                    </span>
                    {/* How many families the line would collect there — the one
                        number that decides whether a quartier is worth the
                        detour, and it was two screens away. */}
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {residents}
                    </span>
                    {checked ? (
                      <input
                        type="hidden"
                        name="neighbourhoodIds"
                        value={neighbourhood.id}
                      />
                    ) : null}
                  </label>
                );
              })}
            </div>
          </div>

          {/* ── Les passagers ────────────────────────────────────────────── */}
          <div className={step === "riders" ? "grid gap-4" : "hidden"}>
            {/*
              Posted whatever the search happens to be showing.

              The rows below are filtered — by the search box, and by whether
              the family took the bus at enrolment — and a passenger already
              ticked must not fall out of the submit because a filter hid their
              row. Keying on the enrolment rather than on a row number is the
              other half of that: the visible order is not the posted order.
            */}
            <div hidden>
              {riders.map((rider) => (
                <React.Fragment key={rider.enrollmentId}>
                  <input
                    type="hidden"
                    name="riderEnrollmentId"
                    value={rider.enrollmentId}
                  />
                  <input
                    type="hidden"
                    name="riderNeighbourhoodId"
                    value={rider.neighbourhoodId}
                  />
                  <input
                    type="hidden"
                    name="riderDirection"
                    value={rider.direction}
                  />
                  {rider.scheduleIds.map((scheduleId) => (
                    <input
                      key={scheduleId}
                      type="hidden"
                      name={`riderSchedules.${rider.enrollmentId}`}
                      value={scheduleId}
                    />
                  ))}
                </React.Fragment>
              ))}
            </div>

            <p className="text-muted-foreground text-sm">
              {t.transport.billingNote}
            </p>

            {/*
              A line with no seats cannot take a passenger, and saying so here
              is the difference between a warning and a bug report: every rider
              ticked onto it is refused FULL by `subscribeRider`, and the only
              trace is a toast on a page that has already navigated away.
            */}
            {seats === 0 ? (
              <p className="text-destructive rounded-lg border border-dashed p-6 text-center text-sm">
                {t.transport.unassignedWarning}
              </p>
            ) : served.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                {t.transport.wizard.ridersNeedNeighbourhoods}
              </p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t.transport.wizard.searchRiders}
                    aria-label={t.transport.wizard.searchRiders}
                  />
                  <label
                    htmlFor="transportOnly"
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                  >
                    <Checkbox
                      id="transportOnly"
                      checked={transportOnly}
                      onCheckedChange={(value) =>
                        setTransportOnly(value === true)
                      }
                    />
                    <span>{t.transport.wizard.transportOnly}</span>
                  </label>
                </div>

                {/* Ticking more children than the bus holds is allowed —
                    `subscribeRider` takes them in order and refuses the
                    overflow — but it should not be a surprise on the toast. */}
                <p
                  className={
                    riders.length > seats
                      ? "text-destructive text-sm font-medium"
                      : "text-muted-foreground text-sm"
                  }
                >
                  {interpolate(t.transport.wizard.seatsUsed, {
                    taken: riders.length,
                    seats,
                  })}
                </p>

                {served.map((neighbourhood, order) => (
                  <div key={neighbourhood.id} className="grid gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-muted-foreground text-xs font-medium">
                        {/* The stop this quartier becomes, and its place on the
                            itinerary. */}
                        {order + 1}
                      </span>
                      <span className="text-sm font-medium">
                        {neighbourhood.label}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {interpolate(t.transport.riderCount, {
                          count: neighbourhood.residents.length,
                        })}
                      </span>
                    </div>

                    {neighbourhood.residents.length === 0 ? (
                      <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-sm">
                        {transportOnly || search.trim() !== ""
                          ? t.transport.wizard.noMatches
                          : t.transport.wizard.noResidents}
                      </p>
                    ) : (
                      <div className="grid gap-2">
                        {neighbourhood.residents.map((student) => {
                          const rider = riders.find(
                            (one) => one.enrollmentId === student.enrollmentId,
                          );
                          const id = `rider-${student.enrollmentId}`;

                          return (
                            <div
                              key={student.enrollmentId}
                              className="grid gap-3 rounded-lg border p-3"
                            >
                              <label
                                htmlFor={id}
                                className="flex items-center gap-2 text-sm"
                              >
                                <Checkbox
                                  id={id}
                                  checked={seated.has(student.enrollmentId)}
                                  onCheckedChange={(value) =>
                                    toggleRider(student, value === true)
                                  }
                                />
                                <span className="min-w-0 flex-1 truncate">
                                  {student.label}
                                </span>
                                {/* Visible only with the filter off, which is
                                    the only way one of these reaches the list.
                                    Seating them is allowed and bills the bus —
                                    see `syncTransportOption` — but it should be
                                    a decision, not a slip. */}
                                {student.usesTransport ? null : (
                                  <Badge
                                    variant="outline"
                                    className="shrink-0 text-xs"
                                  >
                                    {t.transport.wizard.notSubscribed}
                                  </Badge>
                                )}
                              </label>

                              {rider ? (
                                /*
                                  A line that declares runs never also asks
                                  which way the child is going: the run answers
                                  it on its own, and two controls that can
                                  disagree is one too many — the same rule
                                  `subscribeRiderAction` follows.
                                */
                                chosenSchedules.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {chosenSchedules.map((schedule) => {
                                      const checked = rider.scheduleIds.includes(
                                        schedule.id,
                                      );
                                      const runId = `${id}-run-${schedule.id}`;
                                      return (
                                        <label
                                          key={schedule.id}
                                          htmlFor={runId}
                                          className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs"
                                        >
                                          <Checkbox
                                            id={runId}
                                            checked={checked}
                                            onCheckedChange={(value) =>
                                              patchRider(rider.enrollmentId, {
                                                scheduleIds:
                                                  value === true
                                                    ? [
                                                        ...rider.scheduleIds,
                                                        schedule.id,
                                                      ]
                                                    : rider.scheduleIds.filter(
                                                        (one) =>
                                                          one !== schedule.id,
                                                      ),
                                              })
                                            }
                                          />
                                          <span>{schedule.label}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <FormField
                                    name={`${id}-direction`}
                                    label={t.transport.direction}
                                  >
                                    <Select
                                      value={rider.direction}
                                      onValueChange={(value) =>
                                        patchRider(rider.enrollmentId, {
                                          direction: value,
                                        })
                                      }
                                    >
                                      <SelectTrigger
                                        id={`${id}-direction`}
                                        className="w-full"
                                      >
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {TRANSPORT_DIRECTIONS.map((option) => (
                                          <SelectItem key={option} value={option}>
                                            {t.transportOptions.directions[option]}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </FormField>
                                )
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep(visibleSteps[stepIndex - 1] ?? "route")}
          disabled={stepIndex === 0}
        >
          <ChevronLeftIcon className="rtl-flip" />
          {t.common.previous}
        </Button>

        {stepIndex === visibleSteps.length - 1 ? (
          <SubmitButton disabled={!canLeaveRoute}>
            {t.transport.wizard.submit}
          </SubmitButton>
        ) : (
          <Button
            type="button"
            onClick={() => {
              const next = visibleSteps[stepIndex + 1];
              if (next) setStep(next);
            }}
            disabled={step === "route" && !canLeaveRoute}
          >
            {t.common.next}
            <ChevronRightIcon className="rtl-flip" />
          </Button>
        )}
      </div>
    </form>
  );
}
