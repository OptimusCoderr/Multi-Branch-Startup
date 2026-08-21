import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useMe, formatMoney } from "@/lib/use-me";
import { theme } from "@/lib/theme";

type LineItem = { productId: string; name: string; unitPrice: number; quantity: number };

export default function NewSaleScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const currency = me?.companyCurrency ?? "NGN";

  const { data: branchesData } = useQuery({ queryKey: ["branches"], queryFn: api.branches });
  const { data: productsData } = useQuery({ queryKey: ["products"], queryFn: api.products });

  const branches = branchesData?.branches ?? [];
  const [branchId, setBranchId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // A single-shop owner has exactly one branch and shouldn't have to tap a
  // picker with one option in it every time they record a sale.
  useEffect(() => {
    if (branches.length === 1 && branchId === null) setBranchId(branches[0].id);
  }, [branches, branchId]);

  const total = useMemo(() => lineItems.reduce((sum, li) => sum + li.unitPrice * li.quantity, 0), [lineItems]);

  const createSale = useMutation({
    mutationFn: () =>
      api.createSale({
        branchId: branchId!,
        customerName: customerName || undefined,
        lineItems: lineItems.map((li) => ({ productId: li.productId, quantity: li.quantity })),
      }),
    onSuccess: ({ saleId }) => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      router.replace(`/sales/${saleId}`);
    },
    onError: (err: Error) => setError(err.message),
  });

  function addProduct(productId: string, name: string, unitPrice: number) {
    setLineItems((prev) => {
      const existing = prev.find((li) => li.productId === productId);
      if (existing) {
        return prev.map((li) => (li.productId === productId ? { ...li, quantity: li.quantity + 1 } : li));
      }
      return [...prev, { productId, name, unitPrice, quantity: 1 }];
    });
  }

  function changeQuantity(productId: string, delta: number) {
    setLineItems((prev) =>
      prev
        .map((li) => (li.productId === productId ? { ...li, quantity: li.quantity + delta } : li))
        .filter((li) => li.quantity > 0),
    );
  }

  function handleSubmit() {
    setError(null);
    if (!branchId) return setError("Select a branch.");
    if (lineItems.length === 0) return setError("Add at least one product.");
    createSale.mutate();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 16 }}>
      {branches.length > 1 && (
        <View>
          <Text style={styles.label}>Branch</Text>
          <View style={styles.chipRow}>
            {branches.map((b) => (
              <Pressable key={b.id} onPress={() => setBranchId(b.id)} style={[styles.chip, branchId === b.id && styles.chipSelected]}>
                <Text style={[styles.chipText, branchId === b.id && styles.chipTextSelected]}>{b.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {branches.length === 0 && (
        <Text style={styles.muted}>No branches yet — create one on the web app before recording a sale.</Text>
      )}

      <View>
        <Text style={styles.label}>Customer name (optional)</Text>
        <TextInput style={styles.input} placeholder="Walk-in" value={customerName} onChangeText={setCustomerName} />
      </View>

      <View>
        <Text style={styles.label}>Add products</Text>
        <View style={{ gap: 8 }}>
          {(productsData?.products ?? []).map((p) => (
            <Pressable key={p.id} style={styles.productRow} onPress={() => addProduct(p.id, p.name, Number(p.unitPrice))}>
              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{p.name}</Text>
                <Text style={styles.muted}>{p.sku}</Text>
              </View>
              <Text style={styles.muted}>{formatMoney(p.unitPrice, currency)}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {lineItems.length > 0 && (
        <View>
          <Text style={styles.label}>Line items</Text>
          <View style={{ gap: 8 }}>
            {lineItems.map((li) => (
              <View key={li.productId} style={styles.lineItemRow}>
                <Text style={{ flex: 1 }}>{li.name}</Text>
                <Pressable onPress={() => changeQuantity(li.productId, -1)} style={styles.stepperButton}>
                  <Text style={styles.stepperText}>−</Text>
                </Pressable>
                <Text style={styles.qty}>{li.quantity}</Text>
                <Pressable onPress={() => changeQuantity(li.productId, 1)} style={styles.stepperButton}>
                  <Text style={styles.stepperText}>+</Text>
                </Pressable>
                <Text style={styles.lineTotal}>{formatMoney(li.unitPrice * li.quantity, currency)}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.total}>Total: {formatMoney(total, currency)}</Text>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={createSale.isPending}>
        {createSale.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Record sale</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  label: { fontSize: 12, fontWeight: "600", color: "#6b7280", marginBottom: 6, textTransform: "uppercase" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
  chipText: { color: "#374151" },
  chipTextSelected: { color: "#fff" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 10,
  },
  productName: { fontWeight: "500" },
  muted: { color: "#9ca3af", fontSize: 12 },
  lineItemRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepperButton: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: "#d1d5db", alignItems: "center", justifyContent: "center" },
  stepperText: { fontSize: 16, fontWeight: "600" },
  qty: { width: 24, textAlign: "center" },
  lineTotal: { width: 90, textAlign: "right", fontWeight: "500" },
  total: { textAlign: "right", fontWeight: "700", fontSize: 16, marginTop: 8 },
  error: { color: "#dc2626" },
  submitButton: { backgroundColor: theme.primary, borderRadius: 8, paddingVertical: 14, alignItems: "center" },
  submitButtonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
