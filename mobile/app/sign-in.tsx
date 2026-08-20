import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { signIn } from "@/lib/auth-client";

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
    <View style={styles.container}>
      <Text style={styles.title}>Multi-Branch Inventory</Text>
      <Text style={styles.subtitle}>Sign in to your company account</Text>

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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "600", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#6b7280", textAlign: "center", marginBottom: 16 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  error: { color: "#dc2626", fontSize: 14 },
  button: { backgroundColor: "#171717", borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  hint: { fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 24 },
});
