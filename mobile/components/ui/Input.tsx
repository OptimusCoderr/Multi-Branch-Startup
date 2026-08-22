import { View, Text, TextInput, StyleSheet, type TextInputProps } from "react-native";
import { theme } from "@/lib/theme";

export function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={theme.textFaint} {...props} style={[styles.input, props.style]} />;
}

const styles = StyleSheet.create({
  field: { gap: 4 },
  label: { fontSize: theme.font.caption, fontWeight: "600", color: theme.textMuted },
  input: {
    borderWidth: 1,
    borderColor: theme.borderStrong,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: theme.font.body,
    color: theme.textPrimary,
    backgroundColor: theme.surface,
  },
  error: { fontSize: theme.font.caption, color: theme.danger },
});
