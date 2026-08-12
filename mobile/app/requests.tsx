import { Stack, router } from "expo-router";
import { Alert, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCancelRequest, useMyRequests } from "../src/api/hooks";
import { interpolate, label, useFormat, useT } from "../src/i18n";
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  Divider,
  Empty,
  ErrorNote,
  Heading,
  Loading,
} from "../src/ui/components";
import { spacing } from "../src/ui/theme";

/**
 * What the family has asked the school for, and what the school said back.
 *
 * ── One list, open and closed together ──────────────────────────────────────
 * A family files a handful of these a year. Splitting them into tabs would be
 * two nearly empty screens, and the refused one from October is exactly what a
 * parent opens this to re-read. Newest first, so the thing just asked for is at
 * the top.
 *
 * The school's answer sits inside the card rather than in a notification: "come
 * Thursday after 14h" is the answer to *this* request, and a parent looking for
 * it looks at the request.
 */
export default function RequestsScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const requests = useMyRequests();

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: t.requests.title }}
      />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.md,
        }}
      >
        <Button
          label={t.requests.newRequest}
          onPress={() => router.push("/requests/new")}
        />

        {requests.isPending ? <Loading /> : null}
        {requests.isError ? <ErrorNote message={t.requests.loadError} /> : null}

        {requests.data && requests.data.length === 0 ? (
          <Empty message={t.requests.none} />
        ) : null}

        {requests.data?.map((request) => (
          <RequestCard key={request.id} request={request} />
        ))}
      </ScrollView>
    </>
  );
}

/** The tone each status is shown in — green once there is something to collect. */
const TONE: Record<string, "default" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  ACCEPTED: "default",
  READY: "success",
  COLLECTED: "default",
  REJECTED: "danger",
  CANCELLED: "default",
};

function RequestCard({
  request,
}: {
  request: {
    id: string;
    studentName: string;
    typeName: string;
    copies: number;
    reason: string | null;
    status: string;
    requestedAt: string;
    readyAt: string | null;
    officeNote: string | null;
    canCancel: boolean;
  };
}) {
  const t = useT();
  const format = useFormat();
  const cancel = useCancelRequest();

  function withdraw() {
    Alert.alert(t.requests.cancelTitle, t.requests.cancelBody, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.requests.cancelConfirm,
        style: "destructive",
        onPress: () =>
          cancel.mutate(request.id, {
            onSuccess: (result) => {
              // The office started on it between the screen loading and the
              // tap. The list refreshes and the button goes.
              if (!result.ok) Alert.alert(t.requests.cancelTooLate);
            },
            onError: () => Alert.alert(t.requests.cancelFailed),
          }),
      },
    ]);
  }

  return (
    <Card>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: spacing.md,
        }}
      >
        <View style={{ flexShrink: 1, gap: 2 }}>
          <Heading>{request.typeName}</Heading>
          <Caption>
            {request.studentName}
            {request.copies > 1
              ? ` · ${interpolate(t.requests.copiesCount, {
                  count: request.copies,
                })}`
              : ""}
          </Caption>
        </View>

        <Badge tone={TONE[request.status] ?? "default"}>
          {label(t.labels.requestStatus, request.status)}
        </Badge>
      </View>

      <Caption>
        {t.requests.askedOn} {format.shortDate(request.requestedAt)}
      </Caption>

      {/* The school's answer. Both halves are shown whenever they exist: the
          day says when to come, the note says what to bring or why not. */}
      {request.readyAt || request.officeNote ? (
        <>
          <Divider />
          {request.readyAt ? (
            <Body>
              {interpolate(
                request.status === "READY"
                  ? t.requests.readySince
                  : t.requests.comeOn,
                { date: format.shortDate(request.readyAt) },
              )}
            </Body>
          ) : null}
          {request.officeNote ? <Body muted>{request.officeNote}</Body> : null}
        </>
      ) : null}

      {request.status === "READY" && !request.readyAt ? (
        <>
          <Divider />
          <Body>{t.requests.readyNow}</Body>
        </>
      ) : null}

      {request.canCancel ? (
        <>
          <Divider />
          <Button
            label={t.requests.cancel}
            variant="ghost"
            onPress={withdraw}
            busy={cancel.isPending}
          />
        </>
      ) : null}
    </Card>
  );
}
