"use client";

import { BusIcon, TrashIcon } from "lucide-react";
import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { NeighbourhoodOptions } from "@/components/form/neighbourhood-options";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { useT } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import {
  subscribeRiderAction,
  unsubscribeRiderAction,
} from "@/modules/transport/actions";
import {
  SCHEDULE_DIRECTIONS,
  SUBSCRIPTION_STATUSES,
  TRANSPORT_DIRECTIONS,
  type TransportDirection,
} from "@/modules/transport/enums";
import type {
  NeighbourhoodChoice,
  RiderRow,
} from "@/modules/transport/queries";
import { Field } from "@/modules/transport/components/field";

const NONE = "__none__";

/**
 * A pupil's bus arrangement, chosen the way a family describes it.
 *
 * ── Why the cascade is in this order ────────────────────────────────────────
 * A parent says where they live, not which line they want. So the quartier is
 * asked first and everything else narrows from it: only the circuits declared
 * to serve that quartier are offered, only the runs those circuits make, and
 * only the stops standing in it. The secretary never has to know the network.
 *
 * The stop is still what is stored — it is where the bus actually meets them —
 * but it is not usually worth asking about: when a quartier has one stop on the
 * chosen line, the answer is forced and the select is hidden rather than
 * presented as a decision.
 *
 * No price appears anywhere on this screen. The bus is billed once, at
 * enrolment, from the price list; none of these four choices changes what the
 * family owes.
 */
export function TransportPanel({
  enrolmentId,
  neighbourhoods,
  subscriptions,
  defaultNeighbourhoodId,
  canSubscribe,
}: {
  /** Null when the pupil has no place this year — there is nothing to attach to. */
  enrolmentId: string | null;
  neighbourhoods: NeighbourhoodChoice[];
  subscriptions: RiderRow[];
  /**
   * The quartier already on the pupil's file, so the cascade opens on it. Null
   * when the address has not been recorded — see `Student.neighbourhoodId`.
   */
  defaultNeighbourhoodId: string | null;
  canSubscribe: boolean;
}) {
  const t = useT();

  if (!enrolmentId) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={<BusIcon className="size-5" />}
            title={t.transport.notSubscribed}
            description={t.transport.enrolFirst}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {subscriptions.length > 0 ? (
        <CurrentArrangement
          subscriptions={subscriptions}
          canSubscribe={canSubscribe}
        />
      ) : null}

      {canSubscribe ? (
        <SubscribeCard
          enrolmentId={enrolmentId}
          neighbourhoods={neighbourhoods}
          defaultNeighbourhoodId={defaultNeighbourhoodId}
          hasSubscription={subscriptions.length > 0}
        />
      ) : subscriptions.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<BusIcon className="size-5" />}
              title={t.transport.notSubscribed}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/** What the pupil rides today, and what it costs them. */
function CurrentArrangement({
  subscriptions,
  canSubscribe,
}: {
  subscriptions: RiderRow[];
  canSubscribe: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [removing, setRemoving] = React.useState<RiderRow | null>(null);

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{t.transport.arrangement}</CardTitle>
        <CardDescription>{t.transport.subtitle}</CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        <ul className="divide-y">
          {subscriptions.map((subscription) => (
            <li
              key={subscription.subscriptionId}
              className="flex flex-wrap items-center gap-3 px-6 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{subscription.stopName}</p>
                <p className="text-muted-foreground truncate text-sm">
                  {
                    t.transportOptions.directions[
                      subscription.direction as keyof typeof t.transportOptions.directions
                    ]
                  }
                  {subscription.scheduleLabel
                    ? ` · ${subscription.scheduleLabel}`
                    : ""}
                </p>
              </div>

              <Badge variant={subscription.status === "ACTIVE" ? "default" : "outline"}>
                {
                  t.transportOptions.subscriptionStatuses[
                    subscription.status as keyof typeof t.transportOptions.subscriptionStatuses
                  ]
                }
              </Badge>


              {canSubscribe ? (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setRemoving(subscription)}
                  aria-label={t.common.delete}
                >
                  <TrashIcon />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>

      {removing ? (
        <ConfirmDelete
          open={Boolean(removing)}
          onOpenChange={(open) => !open && setRemoving(null)}
          title={t.transport.removeRiderTitle}
          description={t.transport.removeRiderBody}
          action={() => unsubscribeRiderAction(removing.subscriptionId)}
          onDeleted={() => {
            setRemoving(null);
            router.refresh();
          }}
        />
      ) : null}
    </Card>
  );
}

function SubscribeCard({
  enrolmentId,
  neighbourhoods,
  defaultNeighbourhoodId,
  hasSubscription,
}: {
  enrolmentId: string;
  neighbourhoods: NeighbourhoodChoice[];
  defaultNeighbourhoodId: string | null;
  hasSubscription: boolean;
}) {
  const t = useT();
  const router = useRouter();

  const [state, formAction] = useActionState(subscribeRiderAction, IDLE);
  useActionFeedback(state, { onSuccess: () => router.refresh() });

  // The cascade, narrowed by `.find()` in memory — everything arrived nested
  // from `loadTransportChoices`, so choosing a quartier costs no round trip.
  //
  // It opens on the quartier already on the pupil's file, so the secretary who
  // typed the address on the information tab is not asked for it again — and
  // sees the circuits serving it without touching anything. Only when the
  // quartier is one this school serves; an address in a quartier no line covers
  // falls back to asking, which is the honest answer.
  const [neighbourhoodId, setNeighbourhoodId] = React.useState(
    defaultNeighbourhoodId &&
      neighbourhoods.some((entry) => entry.id === defaultNeighbourhoodId)
      ? defaultNeighbourhoodId
      : NONE,
  );
  const [routeId, setRouteId] = React.useState(NONE);
  const [stopId, setStopId] = React.useState(NONE);
  const [direction, setDirection] =
    React.useState<TransportDirection>("BOTH");

  /**
   * The runs the family boards — any number of them, including more than one
   * in the same half of the day.
   *
   * A school with a lunch break commonly runs two AFTERNOON departures — the
   * midday return and the afternoon pickup — and a full-day rider is expected
   * on both, not one or the other. Held as a set of schedule ids rather than a
   * map keyed by direction, so ticking a second run in a column adds it
   * instead of replacing the first. Each ticked run becomes its own
   * abonnement — see `subscribeRiderToRuns`.
   */
  const [runs, setRuns] = React.useState<Set<string>>(() => new Set());

  const errors = state.fieldErrors ?? {};

  const neighbourhood =
    neighbourhoods.find((entry) => entry.id === neighbourhoodId) ?? null;
  const routes = neighbourhood?.routes ?? [];
  const route = routes.find((entry) => entry.id === routeId) ?? null;
  const stops = route?.stops ?? [];

  const schedules = route?.schedules ?? [];
  const chosenRuns = Array.from(runs);

  // One stop in the quartier is not a decision — it is the answer. Resolved
  // here so the hidden input carries it even though no select is drawn.
  const onlyStop = stops.length === 1 ? stops[0] : null;
  const chosenStop =
    onlyStop ?? stops.find((entry) => entry.id === stopId) ?? null;


  if (neighbourhoods.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={<BusIcon className="size-5" />}
            title={t.transport.noNeighbourhoods}
            description={t.transport.noNeighbourhoodsHint}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>
          {hasSubscription ? t.transport.addRider : t.transport.arrangement}
        </CardTitle>
        <CardDescription>{t.transport.arrangementHint}</CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="grid gap-5">
          <input type="hidden" name="enrollmentId" value={enrolmentId} />
          <input type="hidden" name="stopId" value={chosenStop?.id ?? ""} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t.transport.chooseNeighbourhood}
              name="neighbourhoodId"
              required
            >
              <Select
                value={neighbourhoodId}
                onValueChange={(value) => {
                  setNeighbourhoodId(value);
                  // The old line serves the old quartier; keeping it would
                  // submit a stop the server will refuse.
                  setRouteId(NONE);
                  setStopId(NONE);
                  setRuns(new Set());
                }}
              >
                <SelectTrigger id="neighbourhoodId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t.common.none}</SelectItem>
                  <NeighbourhoodOptions neighbourhoods={neighbourhoods} />
                </SelectContent>
              </Select>
            </Field>

            <Field
              label={t.transport.chooseRoute}
              name="routeId"
              error={errors.stopId}
              required
            >
              <Select
                value={routeId}
                onValueChange={(value) => {
                  setRouteId(value);
                  setStopId(NONE);
                  // The runs belong to the old line; keeping them would submit
                  // horaires this bus does not make.
                  setRuns(new Set());
                }}
                disabled={routes.length === 0}
              >
                <SelectTrigger id="routeId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t.common.none}</SelectItem>
                  {routes.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.label}
                      {entry.remaining === 0
                        ? ` · ${t.transport.routeFull}`
                        : ` · ${entry.remaining} ${t.transport.remaining}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* Said plainly rather than left as an empty dropdown: a quartier
              nobody serves is a gap in the network, not a mis-click. */}
          {neighbourhood && routes.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t.transport.noRoutesForNeighbourhood}
            </p>
          ) : null}

          {/*
            The runs, one column per direction, ticked rather than chosen from a
            dropdown: a family says "the 7:30 out and the 17:00 back", which is
            two answers, and the old single select made that two trips through
            the same form. More than one run may be ticked in the same column —
            a lunch-break schedule sends a full-day rider home at midday and
            back out in the afternoon, both AFTERNOON. Each ticked run becomes
            its own abonnement — see `subscribeRiderToRuns`.

            The direction is not asked separately when there are runs to tick,
            because each run already carries it and two controls that can
            contradict each other is one control too many.
          */}
          {schedules.length > 0 ? (
            <fieldset className="grid gap-3">
              <legend className="mb-1 text-sm font-medium">
                {t.transport.chooseRuns}
              </legend>
              <p className="text-muted-foreground -mt-2 text-xs">
                {t.transport.chooseRunsHint}
              </p>

              {chosenRuns.map((id) => (
                <input key={id} type="hidden" name="scheduleIds" value={id} />
              ))}

              <div className="grid gap-3 sm:grid-cols-2">
                {SCHEDULE_DIRECTIONS.map((way) => {
                  const forWay = schedules.filter(
                    (schedule) => schedule.direction === way,
                  );
                  if (forWay.length === 0) return null;

                  return (
                    <div key={way} className="grid gap-2 rounded-lg border p-3">
                      <p className="text-xs font-medium">
                        {t.transportOptions.directions[way]}
                      </p>
                      {forWay.map((schedule) => (
                        <label
                          key={schedule.id}
                          className="hover:bg-muted/50 flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1 text-sm"
                        >
                          <Checkbox
                            checked={runs.has(schedule.id)}
                            onCheckedChange={(checked) =>
                              setRuns((current) => {
                                const next = new Set(current);
                                if (checked) next.add(schedule.id);
                                else next.delete(schedule.id);
                                return next;
                              })
                            }
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {schedule.label} · {schedule.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ) : (
            // No horaires declared on this line yet. The direction is then a
            // real question, and the abonnement carries no run — which is a
            // valid abonnement, see `TransportSubscription.scheduleId`.
            <Field label={t.transport.direction} name="direction">
              <Select
                name="direction"
                value={direction}
                onValueChange={(value) =>
                  setDirection(value as TransportDirection)
                }
              >
                <SelectTrigger id="direction" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSPORT_DIRECTIONS.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {t.transportOptions.directions[entry]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {/* Said plainly rather than left implicit: a line with no horaires is
            a line still being planned, and the abonnement is valid without one. */}
          {route && schedules.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t.transport.noSchedulesOnRoute}
            </p>
          ) : null}

          {/* Only when it is genuinely a choice. */}
          {route && stops.length > 1 ? (
            <Field label={t.transport.chooseStop} name="stopIdChoice" required>
              <Select value={stopId} onValueChange={setStopId}>
                <SelectTrigger id="stopIdChoice" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t.common.none}</SelectItem>
                  {stops.map((stop) => (
                    <SelectItem key={stop.id} value={stop.id}>
                      {stop.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          {route && onlyStop ? (
            <p className="text-muted-foreground text-sm">
              {t.transport.stopAutoResolved} — {onlyStop.label}
            </p>
          ) : null}

          {route?.stopsUnfiltered ? (
            <p className="text-muted-foreground text-sm">
              {t.transport.stopsUnfilteredHint}
            </p>
          ) : null}

          <Field label={t.transport.subscriptionStatus} name="status">
            <Select name="status" defaultValue="ACTIVE">
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBSCRIPTION_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t.transportOptions.subscriptionStatuses[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t.transport.riderNotes} name="notes">
            <Textarea id="notes" name="notes" rows={2} />
          </Field>

          {/* No price is quoted here on purpose: the bus is billed once, at
            enrolment, from the price list. Seating a child at a stop does not
            change what their family owes. */}

          {/* A line that makes runs must be boarded on one of them: the
            abonnement's direction comes from the run, so no run means no
            answer to give the server. */}
          <div className="flex justify-end">
            <SubmitButton
              disabled={
                chosenStop === null ||
                (schedules.length > 0 && chosenRuns.length === 0)
              }
            >
              {t.transport.subscribe}
            </SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
