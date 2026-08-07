import { Link } from "expo-router";
import { Pressable, View } from "react-native";

import { useChannels, useChildren } from "../api/hooks";
import {
  Badge,
  Body,
  Caption,
  Card,
  Empty,
  ErrorNote,
  Heading,
  Loading,
} from "../ui/components";
import { STUDENT_STATUS_LABELS, label } from "../ui/format";
import { spacing } from "../ui/theme";

/**
 * The parent's home: their children, one card each.
 *
 * Deliberately not a dashboard of totals. A parent of two wants to know which
 * of the two the message is about, so the child is the unit of navigation and
 * everything else hangs off the card you tap.
 */
export function FamilySpace() {
  const children = useChildren();

  if (children.isPending) return <Loading />;

  if (children.isError) {
    return <ErrorNote message="Impossible de charger le dossier familial." />;
  }

  if (children.data.length === 0) {
    return (
      <Empty message="Aucun enfant rattaché à ce compte. Contactez le secrétariat de l'école." />
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      {/* The parents' space is the one thing here that is not about one child,
        so it sits above the list rather than inside a child's menu. It renders
        nothing at all when the school has not opened it — see `useChannels`. */}
      <ParentSpaceLink />

      <Heading>Mes enfants</Heading>

      {children.data.map((child) => (
        <Link
          key={child.studentId}
          href={{
            pathname: "/child/[studentId]",
            params: { studentId: child.studentId },
          }}
          asChild
        >
          <Pressable>
            <Card>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: spacing.md,
                }}
              >
                <View style={{ flexShrink: 1, gap: 2 }}>
                  <Heading>{child.fullName}</Heading>
                  <Caption>
                    {[child.levelName, child.className ?? "classe à affecter"]
                      .filter(Boolean)
                      .join(" · ")}
                  </Caption>
                </View>

                <Badge
                  tone={child.status === "ENROLLED" ? "success" : "default"}
                >
                  {label(STUDENT_STATUS_LABELS, child.status)}
                </Badge>
              </View>

              <Body muted>
                {child.schoolName}
                {child.schoolYearName ? ` · ${child.schoolYearName}` : ""}
              </Body>
            </Card>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}


/**
 * The way into the parents' space, when there is one.
 *
 * Absent rather than disabled when the school has both switches off: a control
 * that explains it is turned off teaches a parent the school withheld
 * something, which is not the school's message to send.
 */
function ParentSpaceLink() {
  const channels = useChannels();
  const unread = channels.data?.reduce(
    (total, channel) => total + channel.messageCount,
    0,
  );

  if (!channels.data || channels.data.length === 0) return null;

  return (
    <Link href="/chat" asChild>
      <Pressable>
        <Card>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.md,
            }}
          >
            <View style={{ flexShrink: 1, gap: 2 }}>
              <Heading>Espace parents</Heading>
              <Caption>
                {channels.data.length === 1
                  ? channels.data[0].label
                  : `${channels.data.length} discussions`}
              </Caption>
            </View>
            <Badge>{String(unread ?? 0)}</Badge>
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}
