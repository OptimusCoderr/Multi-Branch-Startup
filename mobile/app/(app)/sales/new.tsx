import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ScanLine } from "lucide-react-native";
import { api, ApiRequestError } from "@/lib/api";
import { useMe, formatMoney, formatQuantity } from "@/lib/use-me";
import { theme } from "@/lib/theme";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";
import { Button, Field, Input, ListItem } from "@/components/ui";
import { enqueueSale, generateClientRequestId } from "@/lib/offline-queue";
import { isOnline } from "@/lib/network-status";

type LineItem =
  | { kind: "product"; productId: string; name: string; unitPrice: number; unitLabel: string; quantity: number }
  | { kind: "service"; key: string; description: string; unitPrice: number; quantity: number };

function lineItemKey(li: LineItem): string {
  return li.kind === "product" ? li.productId : li.key;
}

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
  const [scannerOpen, setScannerOpen] = useState(false);
  const [addingService, setAddingService] = useState(false);
  const [serviceDescription, setServiceDescription] = useState("");
  const [servicePrice, setServicePrice] = useState("");

  // A single-shop owner has exactly one branch and shouldn't have to tap a
  // picker with one option in it every time they record a sale.
  useEffect(() => {
    if (branches.length === 1 && branchId === null) setBranchId(branches[0].id);
  }, [branches, branchId]);

  const total = useMemo(() => lineItems.reduce((sum, li) => sum + li.unitPrice * li.quantity, 0), [lineItems]);

  const createSale = useMutation({
    mutationFn: async () => {
      const input = {
        branchId: branchId!,
        customerName: customerName || undefined,
        lineItems: lineItems.map((li) =>
          li.kind === "product"
            ? { productId: li.productId, quantity: li.quantity }
            : { description: li.description, unitPrice: li.unitPrice, quantity: li.quantity },
        ),
      };
      const clientRequestId = generateClientRequestId();

      // Check connectivity up front rather than always attempting the POST
      // first — on a device that's clearly offline, that would just mean
      // waiting out a request that's guaranteed to fail before falling back.
      if (!(await isOnline())) {
        await enqueueSale(input, clientRequestId);
        return { queued: true as const, saleId: null };
      }

      try {
        const { saleId } = await api.createSale({ ...input, clientRequestId });
        return { queued: false as const, saleId };
      } catch (err) {
        // A validation failure (out of stock, report already submitted,
        // etc.) is a real rejection — surface it. Anything else here is a
        // network-level failure, so the connectivity check above was wrong
        // or the connection dropped mid-request; queue it instead. The
        // clientRequestId carries over, so if this attempt actually reached
        // the server and only the response was lost, a later sync retry is
        // a safe idempotent replay rather than a duplicate sale.
        if (err instanceof ApiRequestError) throw err;
        await enqueueSale(input, clientRequestId);
        return { queued: true as const, saleId: null };
      }
    },
    onSuccess: ({ queued, saleId }) => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (queued) {
        Alert.alert("Saved offline", "This sale will sync automatically once you're back online.");
        router.replace("/sales");
      } else {
        router.replace(`/sales/${saleId}`);
      }
    },
    onError: (err: Error) => setError(err.message),
  });

  function addProduct(productId: string, name: string, unitPrice: number, unitLabel: string) {
    setLineItems((prev) => {
      const existing = prev.find((li) => li.kind === "product" && li.productId === productId);
      if (existing) {
        return prev.map((li) => (li.kind === "product" && li.productId === productId ? { ...li, quantity: li.quantity + 1 } : li));
      }
      return [...prev, { kind: "product", productId, name, unitPrice, unitLabel, quantity: 1 }];
    });
  }

  function addService() {
    const price = Number(servicePrice);
    if (!serviceDescription.trim() || !price || price <= 0) {
      setError("A service needs a description and a price greater than 0.");
      return;
    }
    setError(null);
    setLineItems((prev) => [
      ...prev,
      { kind: "service", key: `service-${Date.now()}`, description: serviceDescription.trim(), unitPrice: price, quantity: 1 },
    ]);
    setServiceDescription("");
    setServicePrice("");
    setAddingService(false);
  }

  function handleBarcodeScanned(data: string) {
    setScannerOpen(false);
    const product = (productsData?.products ?? []).find((p) => p.barcode === data);
    if (!product) {
      setError(`No product found for barcode "${data}".`);
      return;
    }
    setError(null);
    addProduct(product.id, product.name, Number(product.unitPrice), product.unitLabel);
  }

  function changeQuantity(key: string, delta: number) {
    setLineItems((prev) =>
      prev.map((li) => (lineItemKey(li) === key ? { ...li, quantity: li.quantity + delta } : li)).filter((li) => li.quantity > 0),
    );
  }

  function handleSubmit() {
    setError(null);
    if (!branchId) return setError("Select a branch.");
    if (lineItems.length === 0) return setError("Add at least one product or service.");
    createSale.mutate();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
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

      <Field label="Customer name (optional)">
        <Input placeholder="Walk-in" value={customerName} onChangeText={setCustomerName} />
      </Field>

      <View>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Add products</Text>
          <Pressable style={styles.scanButton} onPress={() => setScannerOpen(true)}>
            <ScanLine size={16} color={theme.primary} />
            <Text style={styles.scanButtonText}>Scan</Text>
          </Pressable>
        </View>
        <View style={{ gap: theme.spacing.sm }}>
          {(productsData?.products ?? []).map((p) => (
            <ListItem
              key={p.id}
              title={p.name}
              subtitle={`${p.sku} · per ${p.unitLabel}`}
              trailing={<Text style={styles.muted}>{formatMoney(p.unitPrice, currency)}</Text>}
              onPress={() => addProduct(p.id, p.name, Number(p.unitPrice), p.unitLabel)}
            />
          ))}
        </View>
      </View>

      <View>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Add a service</Text>
          {!addingService && (
            <Pressable style={styles.scanButton} onPress={() => setAddingService(true)}>
              <Text style={styles.scanButtonText}>+ Add</Text>
            </Pressable>
          )}
        </View>
        {addingService && (
          <View style={{ gap: theme.spacing.sm }}>
            <Input placeholder="Description (e.g. Installation)" value={serviceDescription} onChangeText={setServiceDescription} />
            <Input placeholder="Price" value={servicePrice} onChangeText={setServicePrice} keyboardType="decimal-pad" />
            <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
              <Button label="Add service" onPress={addService} />
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => {
                  setAddingService(false);
                  setServiceDescription("");
                  setServicePrice("");
                }}
              />
            </View>
          </View>
        )}
      </View>

      {lineItems.length > 0 && (
        <View>
          <Text style={styles.label}>Line items</Text>
          <View style={{ gap: theme.spacing.sm }}>
            {lineItems.map((li) => {
              const key = lineItemKey(li);
              return (
                <View key={key} style={styles.lineItemRow}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text>{li.kind === "product" ? li.name : li.description}</Text>
                      {li.kind === "service" && (
                        <View style={styles.serviceBadge}>
                          <Text style={styles.serviceBadgeText}>Service</Text>
                        </View>
                      )}
                    </View>
                    {li.kind === "product" && <Text style={styles.muted}>{formatQuantity(li.quantity, li.unitLabel)}</Text>}
                  </View>
                  <Pressable onPress={() => changeQuantity(key, -1)} style={styles.stepperButton}>
                    <Text style={styles.stepperText}>−</Text>
                  </Pressable>
                  <Text style={styles.qty}>{li.quantity}</Text>
                  <Pressable onPress={() => changeQuantity(key, 1)} style={styles.stepperButton}>
                    <Text style={styles.stepperText}>+</Text>
                  </Pressable>
                  <Text style={styles.lineTotal}>{formatMoney(li.unitPrice * li.quantity, currency)}</Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.total}>Total: {formatMoney(total, currency)}</Text>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Button label="Record sale" onPress={handleSubmit} isLoading={createSale.isPending} />

      <BarcodeScannerModal
        visible={scannerOpen}
        onScanned={handleBarcodeScanned}
        onClose={() => setScannerOpen(false)}
        title="Scan a product barcode"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.surface },
  label: { fontSize: theme.font.caption, fontWeight: "600", color: theme.textMuted, marginBottom: 6, textTransform: "uppercase" },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  scanButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 8 },
  scanButtonText: { color: theme.primary, fontWeight: "600", fontSize: 13 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  chip: { borderWidth: 1, borderColor: theme.borderStrong, borderRadius: theme.radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  chipSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
  chipText: { color: "#374151" },
  chipTextSelected: { color: "#fff" },
  muted: { color: theme.textFaint, fontSize: theme.font.caption },
  lineItemRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  serviceBadge: { backgroundColor: theme.primary, borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  serviceBadgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperText: { fontSize: 16, fontWeight: "600" },
  qty: { width: 24, textAlign: "center" },
  lineTotal: { width: 90, textAlign: "right", fontWeight: "500" },
  total: { textAlign: "right", fontWeight: "700", fontSize: 16, marginTop: 8 },
  error: { color: theme.danger },
});
