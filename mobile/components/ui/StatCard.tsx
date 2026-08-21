import { View, Text, StyleSheet } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { theme } from "@/lib/theme";

export function StatCard({
  icon: Icon,
  tint,
  label,
  value,
  highlight,
}: {
  icon: LucideIcon;
  tint: string;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.card}>
      <View style={[styles.iconChip, { backgroundColor: `${tint}1a` }]}>
        <Icon color={tint} size={18} strokeWidth={2.25} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, highlight && { color: theme.warning }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: "47%",
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.surface,
    padding: theme.spacing.md,
    gap: 6,
    ...theme.shadow.sm,
  },
  iconChip: { width: 32, height: 32, borderRadius: theme.radius.md, alignItems: "center", justifyContent: "center" },
  label: { fontSize: theme.font.micro, textTransform: "uppercase", color: theme.textFaint, fontWeight: "600" },
  value: { fontSize: theme.font.h1, fontWeight: "700", color: theme.textPrimary },
});
