"use client";

import { BusIcon, TrashIcon } from "lucide-react";
import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { useT } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  SUBSCRIPTION_STATUSES,
  TRANSPORT_DIRECTIONS,
  schedulesForDirection,
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
  canSubscribe,
}: {
  /** Null when the pupil has no place this year — there is nothing to attach to. */
  enrolmentId: string | null;
  neighbourhoods: NeighbourhoodChoice[];
  subscriptions: RiderRow[];
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
  hasSubscription,
}: {
  enrolmentId: string;
  neighbourhoods: NeighbourhoodChoice[];
  hasSubscription: boolean;
}) {
  const t = useT();
  const router = useRouter();

  const [state, formAction] = useActionState(subscribeRiderAction, IDLE);
  useActionFeedback(state, { onSuccess: () => router.refresh() });

  // The cascade, narrowed by `.find()` in memory — everything arrived nested
  // from `loadTransportChoices`, so choosing a quartier costs no round trip.
  const [neighbourhoodId, setNeighbourhoodId] = React.useState(NONE);
  const [routeId, setRouteId] = React.useState(NONE);
  const [stopId, setStopId] = React.useState(NONE);
  const [direction, setDirection] =
    React.useState<TransportDirection>("BOTH");

  const errors = state.fieldErrors ?? {};

  const neighbourhood =
    neighbourhoods.find((entry) => entry.id === neighbourhoodId) ?? null;
  const routes = neighbourhood?.routes ?? [];
  const route = routes.find((entry) => entry.id === routeId) ?? null;
  const stops = route?.stops ?? [];

  // A one-way rider is only offered the runs that go their way; a BOTH rider
  // sees them all and picks the one they board. See `schedulesForDirection`.
  const allowed = schedulesForDirection(direction);
  const schedules = (route?.schedules ?? []).filter((schedule) =>
    allowed.includes(schedule.direction as (typeof allowed)[number]),
  );

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
                }}
              >
                <SelectTrigger id="neighbourhoodId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t.common.none}</SelectItem>
                  {neighbourhoods.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.label}
                    </SelectItem>
                  ))}
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

          <div className="grid gap-4 sm:grid-cols-2">
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

            <Field label={t.transport.chooseSchedule} name="scheduleId">
              <Select
                name="scheduleId"
                defaultValue={NONE}
                disabled={schedules.length === 0}
              >
                <SelectTrigger id="scheduleId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>
                    {t.transport.noScheduleChosen}
                  </SelectItem>
                  {schedules.map((schedule) => (
                    <SelectItem key={schedule.id} value={schedule.id}>
                      {schedule.label} · {schedule.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

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

          <div className="flex justify-end">
            <SubmitButton disabled={chosenStop === null}>
              {t.transport.subscribe}
            </SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
