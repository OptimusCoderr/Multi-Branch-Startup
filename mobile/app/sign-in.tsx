import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Store } from "lucide-react-native";
import { signIn } from "@/lib/auth-client";
import { theme } from "@/lib/theme";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignIn() {
    setError(null);
    setIsSubmitting(true);
    const { error: signInError } = await signIn.email({ email, password });
    setIsSubmitting(false);
    if (signInError) {
      setError(signInError.message ?? "Could not sign in.");
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
        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.button} onPress={handleSignIn} disabled={isSubmitting}>
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </Pressable>

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
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#fff" },
  subtitle: { fontSize: 14, color: "rgba(255,255,255,0.85)" },
  form: { flex: 1, padding: 24, gap: 12, marginTop: -20, backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginTop: 8 },
  error: { color: "#dc2626", fontSize: 14 },
  button: { backgroundColor: theme.primary, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  hint: { fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 24 },
});
