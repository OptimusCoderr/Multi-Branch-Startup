import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMe, useHasPermission, formatMoney } from "@/lib/use-me";

const PAYMENT_MODES = ["CASH", "CARD", "BANK_TRANSFER", "MOBILE_MONEY", "OTHER"];

export default function SaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: me } = useMe();
  const canPay = useHasPermission("payments.record");
  const currency = me?.companyCurrency ?? "NGN";
  const queryClient = useQueryClient();

  const { data: sale, isLoading } = useQuery({ queryKey: ["sale", id], queryFn: () => api.sale(id) });

  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("CASH");
  const [error, setError] = useState<string | null>(null);

  const recordPayment = useMutation({
    mutationFn: () => api.recordPayment(id, { amount: Number(amount), mode }),
    onSuccess: () => {
      setAmount("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["sale", id] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  if (isLoading || !sale) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const outstanding = Number(sale.grandTotal) - Number(sale.amountPaid);
  const canRecordPayment = canPay && sale.status !== "VOIDED" && sale.status !== "PAID" && outstanding > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View>
        <Text style={styles.saleNumber}>{sale.saleNumber}</Text>
        <Text style={styles.muted}>
          {sale.branchName} · {sale.customerName ?? "Walk-in"}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Line items</Text>
        {sale.lineItems.map((li, i) => (
          <View key={i} style={styles.lineRow}>
            <Text style={{ flex: 1 }}>
              {li.productName} × {li.quantity}
            </Text>
            <Text>{formatMoney(li.lineTotal, currency)}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.lineRow}>
          <Text style={styles.bold}>Grand total</Text>
          <Text style={styles.bold}>{formatMoney(sale.grandTotal, currency)}</Text>
        </View>
        <View style={styles.lineRow}>
          <Text>Paid</Text>
          <Text>{formatMoney(sale.amountPaid, currency)}</Text>
        </View>
        {outstanding > 0 && sale.status !== "VOIDED" && (
          <View style={styles.lineRow}>
            <Text style={styles.outstandingLabel}>Outstanding</Text>
            <Text style={styles.outstandingLabel}>{formatMoney(outstanding, currency)}</Text>
          </View>
        )}
      </View>

      {sale.payments.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payments</Text>
          {sale.payments.map((p) => (
            <View key={p.id} style={styles.lineRow}>
              <Text style={styles.muted}>
                {p.mode.replace("_", " ")} · {new Date(p.paidAt).toLocaleString()}
              </Text>
              <Text>{formatMoney(p.amount, currency)}</Text>
            </View>
          ))}
        </View>
      )}

      {canRecordPayment && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Record payment</Text>
          <TextInput
            style={styles.input}
            placeholder={`Amount (up to ${formatMoney(outstanding, currency)})`}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />
          <View style={styles.chipRow}>
            {PAYMENT_MODES.map((m) => (
              <Pressable key={m} onPress={() => setMode(m)} style={[styles.chip, mode === m && styles.chipSelected]}>
                <Text style={[styles.chipText, mode === m && styles.chipTextSelected]}>{m.replace("_", " ")}</Text>
              </Pressable>
            ))}
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            style={styles.submitButton}
            onPress={() => {
              setError(null);
              if (!amount) return setError("Enter an amount.");
              recordPayment.mutate();
            }}
            disabled={recordPayment.isPending}
          >
            {recordPayment.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Record payment</Text>}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  saleNumber: { fontSize: 20, fontWeight: "700", fontFamily: "monospace" },
  muted: { color: "#9ca3af" },
  card: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 14, gap: 8 },
  cardTitle: { fontSize: 11, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase", marginBottom: 2 },
  lineRow: { flexDirection: "row", justifyContent: "space-between" },
  divider: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 4 },
  bold: { fontWeight: "700" },
  outstandingLabel: { color: "#b45309", fontWeight: "600" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipSelected: { backgroundColor: "#171717", borderColor: "#171717" },
  chipText: { color: "#374151", fontSize: 12 },
  chipTextSelected: { color: "#fff" },
  error: { color: "#dc2626" },
  submitButton: { backgroundColor: "#171717", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  submitButtonText: { color: "#fff", fontWeight: "600" },
});
