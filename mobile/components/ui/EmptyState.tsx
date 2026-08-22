import { View, Text, StyleSheet } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { theme } from "@/lib/theme";

export function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description?: string }) {
  return (
    <View style={styles.container}>
      <View style={styles.iconChip}>
        <Icon size={20} color={theme.textFaint} strokeWidth={1.75} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.border,
    borderRadius: theme.radius.xl,
    paddingVertical: 40,
    paddingHorizontal: theme.spacing.lg,
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: theme.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: theme.font.h2, fontWeight: "600", color: theme.textPrimary },
  description: { fontSize: theme.font.body, color: theme.textMuted, textAlign: "center", maxWidth: 280 },
});
