import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Switch } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ShieldCheck } from "lucide-react-native";
import { authClient } from "@/lib/auth-client";
import { theme } from "@/lib/theme";

export default function TwoFactorScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleVerify() {
    setError(null);
    setIsSubmitting(true);
    const { error: verifyError } = useBackupCode
      ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice })
      : await authClient.twoFactor.verifyTotp({ code, trustDevice });
    setIsSubmitting(false);
    if (verifyError) {
      setError(verifyError.message ?? "That code didn't work.");
      return;
    }
    // On success, app/_layout.tsx's AuthGate reacts to the session change
    // and redirects into (app) itself — no manual navigation needed here.
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <LinearGradient colors={theme.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.logoBadge}>
          <ShieldCheck color="#fff" size={26} strokeWidth={2.25} />
        </View>
        <Text style={styles.title}>Verify it&apos;s you</Text>
        <Text style={styles.subtitle}>
          {useBackupCode ? "Enter one of your backup codes." : "Enter the 6-digit code from your authenticator app."}
        </Text>
      </LinearGradient>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder={useBackupCode ? "Backup code" : "6-digit code"}
          autoCapitalize="none"
          keyboardType={useBackupCode ? "default" : "number-pad"}
          maxLength={useBackupCode ? 16 : 6}
          value={code}
          onChangeText={(v) => setCode(useBackupCode ? v : v.replace(/\D/g, ""))}
        />

        <View style={styles.trustRow}>
          <Text style={styles.trustLabel}>Trust this device for 30 days</Text>
          <Switch value={trustDevice} onValueChange={setTrustDevice} />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.button} onPress={handleVerify} disabled={isSubmitting}>
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify</Text>}
        </Pressable>

        <Pressable
          onPress={() => {
            setUseBackupCode((v) => !v);
            setCode("");
            setError(null);
          }}
        >
          <Text style={styles.switchModeText}>
            {useBackupCode ? "Use your authenticator app instead" : "Use a backup code instead"}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.replace("/sign-in")}>
          <Text style={styles.backText}>Back to sign in</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { paddingTop: 96, paddingBottom: 40, alignItems: "center", gap: 6 },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#fff" },
  subtitle: { fontSize: 14, color: "rgba(255,255,255,0.85)", textAlign: "center", paddingHorizontal: 24 },
  form: { flex: 1, padding: 24, gap: 12, marginTop: -20, backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginTop: 8,
    letterSpacing: 2,
  },
  trustRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  trustLabel: { fontSize: 14, color: "#374151" },
  error: { color: "#dc2626", fontSize: 14 },
  button: { backgroundColor: theme.primary, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  switchModeText: { fontSize: 13, color: theme.primary, textAlign: "center", marginTop: 20, fontWeight: "600" },
  backText: { fontSize: 13, color: "#9ca3af", textAlign: "center", marginTop: 16 },
});
