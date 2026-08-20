import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { theme } from "@/lib/theme";

export default function NewCustomerScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createCustomer = useMutation({
    mutationFn: () => api.createCustomer({ name, phone: phone || undefined, email: email || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      router.back();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <View style={styles.container}>
      <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Phone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={styles.button}
        onPress={() => {
          setError(null);
          if (!name.trim()) return setError("Name is required.");
          createCustomer.mutate();
        }}
        disabled={createCustomer.isPending}
      >
        {createCustomer.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create customer</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16, gap: 12 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  error: { color: "#dc2626" },
  button: { backgroundColor: theme.primary, borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
});
