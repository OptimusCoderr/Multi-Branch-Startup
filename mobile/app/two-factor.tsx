import { useState } from "react";
import { View, Text, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Switch } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ShieldCheck } from "lucide-react-native";
import { authClient } from "@/lib/auth-client";
import { theme } from "@/lib/theme";
import { Button, Field, Input } from "@/components/ui";

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
        <Field label={useBackupCode ? "Backup code" : "6-digit code"}>
          <Input
            style={{ letterSpacing: 2 }}
            autoCapitalize="none"
            keyboardType={useBackupCode ? "default" : "number-pad"}
            maxLength={useBackupCode ? 16 : 6}
            value={code}
            onChangeText={(v) => setCode(useBackupCode ? v : v.replace(/\D/g, ""))}
          />
        </Field>

        <View style={styles.trustRow}>
          <Text style={styles.trustLabel}>Trust this device for 30 days</Text>
          <Switch value={trustDevice} onValueChange={setTrustDevice} />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.buttonWrap}>
          <Button label="Verify" onPress={handleVerify} isLoading={isSubmitting} />
        </View>

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
    borderRadius: theme.radius.xl,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: { fontSize: theme.font.display, fontWeight: "700", color: "#fff" },
  subtitle: { fontSize: theme.font.body, color: "rgba(255,255,255,0.85)", textAlign: "center", paddingHorizontal: 24 },
  form: {
    flex: 1,
    padding: 24,
    gap: theme.spacing.md,
    marginTop: -20,
    backgroundColor: theme.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  trustRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  trustLabel: { fontSize: theme.font.body, color: "#374151" },
  error: { color: theme.danger, fontSize: theme.font.body },
  buttonWrap: { marginTop: 8 },
  switchModeText: { fontSize: 13, color: theme.primary, textAlign: "center", marginTop: 12, fontWeight: "600" },
  backText: { fontSize: 13, color: theme.textFaint, textAlign: "center", marginTop: 16 },
});
