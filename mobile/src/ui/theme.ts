import { useColorScheme } from "react-native";

/**
 * The app's colours, in both schemes.
 *
 * Deliberately a small fixed palette rather than a styling library: four
 * screens do not need a design system, and a phone that renders a bus register
 * at 06:45 in a dark cab needs the dark scheme to be genuinely dark rather than
 * a tinted light one.
 */

export type Theme = {
  background: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  primaryText: string;
  success: string;
  warning: string;
  danger: string;
};

const light: Theme = {
  background: "#f6f7f9",
  card: "#ffffff",
  border: "#e3e6ea",
  text: "#11161c",
  muted: "#6b7683",
  primary: "#1f5f4f",
  primaryText: "#ffffff",
  success: "#1a7f4b",
  warning: "#a86a00",
  danger: "#b3261e",
};

const dark: Theme = {
  background: "#0e1216",
  card: "#161c22",
  border: "#28313a",
  text: "#f2f5f7",
  muted: "#9aa6b2",
  primary: "#5fd0ae",
  primaryText: "#06231c",
  success: "#4ecb8b",
  warning: "#e5a13a",
  danger: "#ef6f68",
};

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16 };
