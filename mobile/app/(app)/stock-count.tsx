import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ScanLine } from "lucide-react-native";
import { api, type StockProduct } from "@/lib/api";
import { useHasPermission } from "@/lib/use-me";
import { theme } from "@/lib/theme";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";

/**
 * Physical stock count / cycle count: pick a branch, tally what's actually
 * on the shelf (by scanning each unit, or typing an exact count), and see
 * the delta against the system quantity before committing anything.
 * Nothing is adjusted until "Save count" — scanning/typing only builds up
 * a local tally, exactly like the sale line-item cart.
 */
export default function StockCountScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canAdjust = useHasPermission("branches.manage");

  const { data: branchesData } = useQuery({ queryKey: ["branches"], queryFn: api.branches });
  const { data: stockData, isLoading } = useQuery({ queryKey: ["stock"], queryFn: api.stock });

  const branches = branchesData?.branches ?? [];
  const [branchId, setBranchId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [scannerOpen, setScannerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (branches.length === 1 && branchId === null) setBranchId(branches[0].id);
  }, [branches, branchId]);

  // Reset the tally when switching branches — a count only ever applies to one location at a time.
  useEffect(() => {
    setCounted({});
  }, [branchId]);

  const productsAtBranch = useMemo(() => {
    if (!branchId || !stockData) return [];
    return stockData.products
      .map((p) => ({ ...p, branchStock: p.branchStocks.find((s) => s.branchId === branchId) }))
      .filter((p): p is StockProduct & { branchStock: { branchId: string; branchName: string; quantity: number } } => Boolean(p.branchStock));
  }, [stockData, branchId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return productsAtBranch;
    return productsAtBranch.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [productsAtBranch, search]);

  const tallyRows = useMemo(
    () =>
      productsAtBranch
        .filter((p) => counted[p.id] !== undefined && counted[p.id] !== "")
        .map((p) => {
          const countedQty = Number(counted[p.id]) || 0;
          return { ...p, countedQty, delta: countedQty - p.branchStock.quantity };
        }),
    [productsAtBranch, counted],
  );
  const changedCount = tallyRows.filter((r) => r.delta !== 0).length;

  function setCount(productId: string, value: string) {
    setCounted((prev) => ({ ...prev, [productId]: value }));
  }

  function handleBarcodeScanned(data: string) {
    setScannerOpen(false);
    const product = productsAtBranch.find((p) => p.barcode === data);
    if (!product) {
      setError(`No product found for barcode "${data}" at this branch.`);
      return;
    }
    setError(null);
    setCounted((prev) => {
      const current = Number(prev[product.id]) || 0;
      return { ...prev, [product.id]: String(current + 1) };
    });
  }

  async function handleSave() {
    if (!branchId) return;
    const toAdjust = tallyRows.filter((r) => r.delta !== 0);
    if (toAdjust.length === 0) {
      setError("No counted quantities differ from the system total — nothing to save.");
      return;
    }

    Alert.alert(
      "Save stock count?",
      `This will adjust ${toAdjust.length} product${toAdjust.length === 1 ? "" : "s"} to match your count. This can't be undone automatically.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: async () => {
            setIsSaving(true);
            setError(null);
            try {
              for (const row of toAdjust) {
                await api.adjustStock({ productId: row.id, branchId, delta: row.delta, reason: "Stock count" });
              }
              await queryClient.invalidateQueries({ queryKey: ["stock"] });
              setCounted({});
              Alert.alert("Count saved", `${toAdjust.length} product${toAdjust.length === 1 ? "" : "s"} adjusted.`, [
                { text: "OK", onPress: () => router.back() },
              ]);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not save the count.");
            } finally {
              setIsSaving(false);
            }
          },
        },
      ],
    );
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

      {branches.length === 0 && <Text style={styles.muted}>No branches yet — create one on the web app first.</Text>}

      {branchId && (
        <>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Count products</Text>
            <Pressable style={styles.scanButton} onPress={() => setScannerOpen(true)}>
              <ScanLine size={16} color={theme.primary} />
              <Text style={styles.scanButtonText}>Scan</Text>
            </Pressable>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Search by name or SKU"
            value={search}
            onChangeText={setSearch}
          />

          {isLoading ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <View style={{ gap: 8 }}>
              {filtered.map((p) => {
                const countedValue = counted[p.id] ?? "";
                const countedQty = Number(countedValue) || 0;
                const delta = countedValue === "" ? null : countedQty - p.branchStock.quantity;
                return (
                  <View key={p.id} style={styles.productRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName}>{p.name}</Text>
                      <Text style={styles.muted}>
                        {p.sku} · system: {p.branchStock.quantity}
                      </Text>
                    </View>
                    <TextInput
                      style={styles.countInput}
                      keyboardType="number-pad"
                      placeholder="—"
                      value={countedValue}
                      onChangeText={(v) => setCount(p.id, v.replace(/[^0-9]/g, ""))}
                    />
                    {delta !== null && delta !== 0 && (
                      <Text style={[styles.delta, delta > 0 ? styles.deltaPositive : styles.deltaNegative]}>
                        {delta > 0 ? `+${delta}` : delta}
                      </Text>
                    )}
                  </View>
                );
              })}
              {filtered.length === 0 && <Text style={styles.muted}>No products match.</Text>}
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          {canAdjust ? (
            <Pressable style={styles.submitButton} onPress={handleSave} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  Save count{changedCount > 0 ? ` (${changedCount} change${changedCount === 1 ? "" : "s"})` : ""}
                </Text>
              )}
            </Pressable>
          ) : (
            <Text style={styles.muted}>You don&apos;t have permission to save stock adjustments — ask an Owner or Admin.</Text>
          )}
        </>
      )}

      <BarcodeScannerModal
        visible={scannerOpen}
        onScanned={handleBarcodeScanned}
        onClose={() => setScannerOpen(false)}
        title="Scan to count"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  label: { fontSize: 12, fontWeight: "600", color: "#6b7280", marginBottom: 6, textTransform: "uppercase" },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  scanButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 8 },
  scanButtonText: { color: theme.primary, fontWeight: "600", fontSize: 13 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
  chipText: { color: "#374151" },
  chipTextSelected: { color: "#fff" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 10,
  },
  productName: { fontWeight: "500" },
  muted: { color: "#9ca3af", fontSize: 12 },
  countInput: {
    width: 64,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    textAlign: "center",
  },
  delta: { width: 40, textAlign: "right", fontWeight: "700", fontVariant: ["tabular-nums"] },
  deltaPositive: { color: theme.success },
  deltaNegative: { color: theme.danger },
  error: { color: "#dc2626" },
  submitButton: { backgroundColor: theme.primary, borderRadius: 8, paddingVertical: 14, alignItems: "center" },
  submitButtonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
