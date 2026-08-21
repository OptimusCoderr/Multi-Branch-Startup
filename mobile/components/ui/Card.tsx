import type { ReactNode } from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { theme } from "@/lib/theme";

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.surface,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
    ...theme.shadow.sm,
  },
});
