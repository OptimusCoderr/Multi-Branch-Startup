import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { theme } from "@/lib/theme";
import { Button, Field, Input } from "@/components/ui";

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
      <Field label="Name">
        <Input value={name} onChangeText={setName} />
      </Field>
      <Field label="Phone">
        <Input keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      </Field>
      <Field label="Email">
        <Input autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      </Field>

      {error && <Text style={styles.error}>{error}</Text>}

      <Button
        label="Create customer"
        isLoading={createCustomer.isPending}
        onPress={() => {
          setError(null);
          if (!name.trim()) return setError("Name is required.");
          createCustomer.mutate();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.surface, padding: theme.spacing.lg, gap: theme.spacing.md },
  error: { color: theme.danger },
});
