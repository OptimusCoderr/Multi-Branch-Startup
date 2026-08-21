import { View, Text, StyleSheet } from "react-native";
import { theme } from "@/lib/theme";

export type BadgeVariant = "success" | "warning" | "danger" | "neutral" | "brand";

const VARIANT_COLORS: Record<BadgeVariant, { bg: string; fg: string }> = {
  success: { bg: "#dcfce7", fg: "#15803d" },
  warning: { bg: "#fef3c7", fg: "#b45309" },
  danger: { bg: "#fee2e2", fg: "#b91c1c" },
  neutral: { bg: "#f3f4f6", fg: "#6b7280" },
  brand: { bg: "#e0e7ff", fg: theme.primaryDark },
};

export function Badge({ variant = "neutral", label }: { variant?: BadgeVariant; label: string }) {
  const colors = VARIANT_COLORS[variant];
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.label, { color: colors.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start", borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  label: { fontSize: theme.font.micro, fontWeight: "600" },
});
