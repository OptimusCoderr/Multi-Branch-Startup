import type { ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { theme } from "@/lib/theme";

export function ListItem({
  icon: Icon,
  iconTint = theme.primary,
  title,
  subtitle,
  trailing,
  onPress,
}: {
  icon?: LucideIcon;
  iconTint?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.row}>
      {Icon && (
        <View style={[styles.iconChip, { backgroundColor: `${iconTint}1a` }]}>
          <Icon size={18} color={iconTint} strokeWidth={2.25} />
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing && <View style={styles.trailing}>{trailing}</View>}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}>
        {content}
      </Pressable>
    );
  }
  return <View style={styles.pressable}>{content}</View>;
}

const styles = StyleSheet.create({
  pressable: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.surface,
    padding: theme.spacing.sm,
  },
  pressed: { backgroundColor: theme.surfaceMuted },
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  iconChip: { width: 36, height: 36, borderRadius: theme.radius.md, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: 2 },
  title: { fontSize: theme.font.body, fontWeight: "600", color: theme.textPrimary },
  subtitle: { fontSize: theme.font.caption, color: theme.textMuted },
  trailing: { alignItems: "flex-end" },
});
