import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { radius, spacing, useTheme } from "./theme";

/** The pieces every screen is built from. Four screens, one vocabulary. */

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.md,
          padding: spacing.lg,
          gap: spacing.sm,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text style={{ color: theme.text, fontSize: 22, fontWeight: "700" }}>
      {children}
    </Text>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text style={{ color: theme.text, fontSize: 16, fontWeight: "600" }}>
      {children}
    </Text>
  );
}

export function Body({
  children,
  muted,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  const theme = useTheme();
  return (
    <Text style={{ color: muted ? theme.muted : theme.text, fontSize: 14 }}>
      {children}
    </Text>
  );
}

export function Caption({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text style={{ color: theme.muted, fontSize: 12 }}>{children}</Text>
  );
}

/** A number and what it counts — the unit the dashboards are made of. */
export function Stat({
  value,
  label,
  tone,
}: {
  value: string | number;
  label: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const theme = useTheme();
  const color =
    tone === "success"
      ? theme.success
      : tone === "warning"
        ? theme.warning
        : tone === "danger"
          ? theme.danger
          : theme.text;

  return (
    <View style={{ gap: 2, minWidth: 96, flexGrow: 1, flexBasis: "40%" }}>
      <Text style={{ color, fontSize: 24, fontWeight: "700" }}>{value}</Text>
      <Text style={{ color: theme.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const theme = useTheme();
  const color =
    tone === "success"
      ? theme.success
      : tone === "warning"
        ? theme.warning
        : tone === "danger"
          ? theme.danger
          : theme.muted;

  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderColor: color,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
      }}
    >
      <Text style={{ color, fontSize: 12, fontWeight: "600" }}>{children}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost";
  disabled?: boolean;
  busy?: boolean;
}) {
  const theme = useTheme();
  const isPrimary = variant === "primary";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => ({
        backgroundColor: isPrimary ? theme.primary : "transparent",
        borderColor: isPrimary ? theme.primary : theme.border,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius.sm,
        paddingVertical: 14,
        paddingHorizontal: spacing.lg,
        alignItems: "center",
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color={isPrimary ? theme.primaryText : theme.text} />
      ) : (
        <Text
          style={{
            color: isPrimary ? theme.primaryText : theme.text,
            fontWeight: "600",
            fontSize: 15,
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** Rows the whole app uses: a label on the left, a value on the right. */
export function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const theme = useTheme();
  const color =
    tone === "success"
      ? theme.success
      : tone === "warning"
        ? theme.warning
        : tone === "danger"
          ? theme.danger
          : theme.text;

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: 6,
      }}
    >
      <Text style={{ color: theme.muted, fontSize: 14, flexShrink: 1 }}>
        {label}
      </Text>
      <Text style={{ color, fontSize: 14, fontWeight: "600" }}>{value}</Text>
    </View>
  );
}

export function Divider() {
  const theme = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.border,
        marginVertical: spacing.sm,
      }}
    />
  );
}

export function Loading() {
  const theme = useTheme();
  return (
    <View style={{ padding: spacing.xxl, alignItems: "center" }}>
      <ActivityIndicator color={theme.primary} />
    </View>
  );
}

/**
 * What a screen shows when there is nothing to show. Always a sentence, never a
 * blank panel: "no runs today" and "the request failed" must not look alike.
 */
export function Empty({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <View style={{ padding: spacing.xl, alignItems: "center" }}>
      <Text style={{ color: theme.muted, fontSize: 14, textAlign: "center" }}>
        {message}
      </Text>
    </View>
  );
}

export function ErrorNote({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        borderColor: theme.danger,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius.sm,
        padding: spacing.md,
        backgroundColor: theme.card,
      }}
    >
      <Text style={{ color: theme.danger, fontSize: 14 }}>{message}</Text>
    </View>
  );
}

/**
 * One tile of a child's menu.
 *
 * Two per row, tall enough to hit without aiming — this is the control a parent
 * uses one-handed on a phone, standing up. The badge is where the tile earns
 * its place: "3 non justifiées" or "2 pièces manquantes" is what makes the grid
 * worth reading rather than a list of words you already knew were there.
 */
export function Tile({
  label,
  hint,
  icon,
  badge,
  tone = "default",
  onPress,
}: {
  label: string;
  hint?: string;
  /** A Material Community glyph name — see the tiles in app/child/[studentId]. */
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  /** A short figure, e.g. "3" or "2 manquantes". Absent when there is nothing to say. */
  badge?: string;
  tone?: "default" | "success" | "warning" | "danger";
  onPress: () => void;
}) {
  const theme = useTheme();
  const toneColor =
    tone === "success"
      ? theme.success
      : tone === "warning"
        ? theme.warning
        : tone === "danger"
          ? theme.danger
          : theme.primary;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      style={({ pressed }) => ({
        flexBasis: "48%",
        flexGrow: 1,
        backgroundColor: theme.card,
        borderColor: pressed ? toneColor : theme.border,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius.md,
        padding: spacing.lg,
        gap: spacing.xs,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.sm,
        }}
      >
        {/* The glyph carries the tone, not the whole card: a grid of eight
          coloured panels is a colour chart, and the badge beside it is what
          the parent is actually meant to notice. */}
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: radius.sm,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: `${toneColor}1a`,
          }}
        >
          <MaterialCommunityIcons name={icon} size={19} color={toneColor} />
        </View>
        {badge ? (
          <View
            style={{
              backgroundColor: `${toneColor}22`,
              borderRadius: radius.sm,
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
            }}
          >
            <Text style={{ color: toneColor, fontSize: 12, fontWeight: "700" }}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>

      <Text
        style={{ color: theme.text, fontSize: 15, fontWeight: "600" }}
        numberOfLines={1}
      >
        {label}
      </Text>

      {hint ? (
        <Text style={{ color: theme.muted, fontSize: 12 }} numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** The grid the tiles sit in. Two columns, wrapping. */
export function TileGrid({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.md,
      }}
    >
      {children}
    </View>
  );
}

/**
 * A row of one-tap filters.
 *
 * Chips rather than a picker: there are three or four options, a phone has room
 * for them, and a filter you can see the state of without opening anything is
 * the difference between a control people use and one they do not find. The
 * first chip is always the one that clears — "Tous" is a filter value here, not
 * a separate reset button nobody presses.
 */
export function FilterChips({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const theme = useTheme();

  if (options.length <= 2) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.sm, paddingVertical: 2 }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm - 2,
              borderRadius: radius.lg,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: active ? theme.primary : theme.border,
              backgroundColor: active ? `${theme.primary}1a` : theme.card,
            }}
          >
            <Text
              style={{
                color: active ? theme.primary : theme.muted,
                fontSize: 13,
                fontWeight: active ? "700" : "500",
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
