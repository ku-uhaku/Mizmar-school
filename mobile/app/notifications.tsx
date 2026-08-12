import { Stack, useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  unreadOf,
  useMarkNotificationsRead,
  useNotifications,
} from "../src/api/hooks";
import type { AppNotification } from "../src/api/types";
import { interpolate, label, useFormat, useT } from "../src/i18n";
import { Empty, ErrorNote, Loading } from "../src/ui/components";
import { radius, spacing, useTheme } from "../src/ui/theme";

/**
 * The inbox, for whichever space the account is in.
 *
 * ── One screen for all four spaces ──────────────────────────────────────────
 * A parent, a teacher, a chauffeur and a directrice read the same list from the
 * same endpoint, because the scope is the account and not the space. An account
 * that is both a teacher and a parent sees both sorts of line, which is right:
 * splitting them would mean deciding on their behalf which of the two they are
 * reading it as, and they would have to remember to check twice.
 *
 * ── Reading is not opening ──────────────────────────────────────────────────
 * Pressing a line marks it read and, where there is somewhere to go, goes
 * there. Lines with nowhere to go are still pressable, because "I have seen
 * this" is itself the thing a reader wants to say.
 *
 * ── A list that goes on, in both directions ─────────────────────────────────
 * Pull down to re-read the top; scroll to the bottom and the next page arrives.
 * An inbox is the one screen here with no natural end — a family accumulates
 * one line per absence, per mark, per receipt — so it is also the one that
 * cannot be a single `ScrollView` of everything. This is the app's only
 * `FlatList` for that reason: it renders the rows near the viewport instead of
 * all of them, which is what keeps the screen usable at a thousand lines.
 */
export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const t = useT();

  const inbox = useNotifications();
  const markRead = useMarkNotificationsRead();

  // Every loaded page, flattened — the pages are a fetching detail, not
  // something a reader should be able to see the seams of.
  const items = inbox.data?.pages.flatMap((page) => page.items) ?? [];
  const unread = unreadOf(inbox.data);

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: t.notifications.title }}
      />

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.sm,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl
            // `isRefetching` and not `isFetching`: the latter is also true while
            // the *next page* loads, which would spin the pull-to-refresh
            // indicator at the top every time somebody scrolled to the bottom.
            refreshing={inbox.isRefetching && !inbox.isFetchingNextPage}
            onRefresh={() => void inbox.refetch()}
            tintColor={theme.muted}
          />
        }
        /*
          Half a screen from the end. Waiting for the actual bottom means the
          reader hits it and stops, which is the jolt this is meant to avoid;
          much more than half a screen and a slow scroll fetches pages nobody
          reaches.
        */
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          // Guarded: `onEndReached` fires repeatedly while the list settles, and
          // without this each bounce would start another request for the page
          // already in flight.
          if (inbox.hasNextPage && !inbox.isFetchingNextPage) {
            void inbox.fetchNextPage();
          }
        }}
        ListHeaderComponent={
          unread > 0 ? (
            <Pressable
              onPress={() => markRead.mutate({ all: true })}
              disabled={markRead.isPending}
              accessibilityRole="button"
              style={{
                alignSelf: "flex-end",
                padding: spacing.sm,
                marginBottom: spacing.xs,
              }}
            >
              <Text style={{ color: theme.primary, fontWeight: "600" }}>
                {t.notifications.markAllRead}
              </Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          inbox.isPending ? (
            <Loading />
          ) : inbox.isError ? (
            <ErrorNote message={t.notifications.loadError} />
          ) : (
            <Empty message={t.notifications.none} />
          )
        }
        ListFooterComponent={
          inbox.isFetchingNextPage ? (
            <View style={{ paddingVertical: spacing.lg }}>
              <ActivityIndicator color={theme.muted} />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <NotificationRow
            item={item}
            onRead={() => markRead.mutate({ id: item.id })}
          />
        )}
      />
    </>
  );
}

/** Where each kind opens on the phone. Null when it opens nothing. */
function routeFor(
  item: AppNotification,
): { pathname: string; params: Record<string, string> } | null {
  // Every family screen hangs off a child, so a line with no `studentId` has
  // nowhere on this app to go — which is the ordinary case for the staff kinds,
  // whose destination is the web dashboard.
  const child = (topic: string) =>
    item.studentId
      ? {
          pathname: "/child/[studentId]/[topic]",
          params: { studentId: item.studentId, topic },
        }
      : null;

  switch (item.kind) {
    case "EVENT_PUBLISHED":
      return child("evenements");
    case "MARKS_PUBLISHED":
      return child("notes");
    case "BULLETIN_PUBLISHED":
      return child("notes");
    case "REMARK_SHARED":
      return child("remarques");
    case "PAYMENT_RECORDED":
      return child("paiements");
    case "ASSESSMENT_SCHEDULED":
      // The papers are on the marks screen whether or not they have been sat —
      // a devoir announced on Monday and marked on Friday is one row there.
      return child("notes");
    case "ATTENDANCE_MISSED":
      return child("absences");
    case "TRANSPORT_MISSED":
      return child("transport");
    case "SUPPLY_LIST_APPROVED":
      return child("fournitures");
    case "REQUEST_HANDLED":
      return { pathname: "/requests", params: {} };
    default:
      return null;
  }
}

/**
 * Which module's words a kind's `status` is spelled in. Mirrors
 * `statusVocabulary` in modules/notifications/describe.ts.
 */
function statusVocabulary(
  kind: AppNotification["kind"],
  t: ReturnType<typeof useT>,
): Record<string, string> {
  switch (kind) {
    case "ATTENDANCE_MISSED":
    case "TRANSPORT_MISSED":
      return t.labels.attendance;
    case "SUPPLY_LIST_REVIEWED":
      return t.labels.supplyStatus;
    case "LEAVE_DECIDED":
      return t.labels.leaveStatus;
    case "ADVANCE_DECIDED":
      return t.labels.advanceStatus;
    default:
      return t.labels.requestStatus;
  }
}

function NotificationRow({
  item,
  onRead,
}: {
  item: AppNotification;
  onRead: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const t = useT();
  const format = useFormat();

  const phrase = t.notifications.kinds[item.kind];
  // A kind this build has never heard of — an old app against a newer server —
  // is dropped rather than drawn as a blank row. See the note on the type.
  if (!phrase) return null;

  const params = { ...item.params };
  // Five vocabularies, never merged into one map — see the note in the web's
  // describe.ts. "APPROVED" is a supply list the office agreed to buy and a
  // congé the directrice granted, and they are not the same word.
  if (params.status) {
    params.status = label(statusVocabulary(item.kind, t), params.status);
  }
  if (params.amountCentimes) {
    const centimes = Number(params.amountCentimes);
    if (Number.isFinite(centimes)) params.amount = format.money(centimes);
  }
  if (params.date) params.date = format.shortDate(params.date);

  const tones: Record<AppNotification["tone"], string> = {
    info: theme.primary,
    good: theme.success,
    warn: theme.warning,
  };

  const open = () => {
    onRead();
    const route = routeFor(item);
    if (route) router.push(route as never);
  };

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.md,
        backgroundColor: theme.card,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.border,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          marginTop: 6,
          backgroundColor: item.isRead ? "transparent" : tones[item.tone],
        }}
      />

      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            color: item.isRead ? theme.muted : theme.text,
            fontWeight: item.isRead ? "400" : "600",
            lineHeight: 20,
          }}
        >
          {interpolate(phrase, params)}
        </Text>
        <Text style={{ color: theme.muted, fontSize: 12 }}>
          {`${format.shortDate(item.createdAt)} · ${format.clock(item.createdAt)}`}
        </Text>
      </View>
    </Pressable>
  );
}
