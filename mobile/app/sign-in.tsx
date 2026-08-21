import { useState } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Store } from "lucide-react-native";
import { signIn } from "@/lib/auth-client";
import { theme } from "@/lib/theme";
import { Button, Field, Input } from "@/components/ui";

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignIn() {
    setError(null);
    setIsSubmitting(true);
    const { data, error: signInError } = await signIn.email({ email, password });
    setIsSubmitting(false);
    if (signInError) {
      setError(signInError.message ?? "Could not sign in.");
      return;
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      router.push("/two-factor");
      return;
    }
    // On success, app/_layout.tsx's AuthGate reacts to the session change
    // and redirects into (app) itself — no manual navigation needed here.
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <LinearGradient colors={theme.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.logoBadge}>
          <Store color="#fff" size={26} strokeWidth={2.25} />
        </View>
        <Text style={styles.title}>Multi-Branch Inventory</Text>
        <Text style={styles.subtitle}>Sign in to your company account</Text>
      </LinearGradient>

      <View style={styles.form}>
        <Field label="Email">
          <Input autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        </Field>
        <Field label="Password">
          <Input secureTextEntry value={password} onChangeText={setPassword} />
        </Field>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.buttonWrap}>
          <Button label="Sign in" onPress={handleSignIn} isLoading={isSubmitting} />
        </View>

        <Text style={styles.hint}>New companies and staff invitations are set up on the web app for now.</Text>
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
  subtitle: { fontSize: theme.font.body, color: "rgba(255,255,255,0.85)" },
  form: {
    flex: 1,
    padding: 24,
    gap: theme.spacing.md,
    marginTop: -20,
    backgroundColor: theme.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  error: { color: theme.danger, fontSize: theme.font.body },
  buttonWrap: { marginTop: 8 },
  hint: { fontSize: theme.font.caption, color: theme.textFaint, textAlign: "center", marginTop: 24 },
});
