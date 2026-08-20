import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api, type StockProduct } from "@/lib/api";

export default function StockScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["stock"], queryFn: api.stock });

  return (
    <View style={styles.container}>
      {isLoading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : (
        <FlatList
          data={data?.products ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={<Text style={styles.muted}>No products yet.</Text>}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }: { item: StockProduct }) => (
            <View style={styles.card}>
              <Text style={styles.productName}>
                {item.name} <Text style={styles.sku}>({item.sku})</Text>
              </Text>
              {item.branchStocks.map((s) => (
                <View key={s.branchId} style={styles.row}>
                  <Text style={styles.location}>{s.branchName}</Text>
                  <Text style={[styles.qty, s.quantity === 0 && styles.qtyZero]}>{s.quantity}</Text>
                </View>
              ))}
              {item.warehouseStocks.map((s) => (
                <View key={s.warehouseId} style={styles.row}>
                  <Text style={styles.location}>{s.warehouseName} (warehouse)</Text>
                  <Text style={[styles.qty, s.quantity === 0 && styles.qtyZero]}>{s.quantity}</Text>
                </View>
              ))}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  muted: { color: "#9ca3af", padding: 16 },
  card: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 12, gap: 6 },
  productName: { fontWeight: "600" },
  sku: { fontFamily: "monospace", fontWeight: "400", color: "#9ca3af", fontSize: 12 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  location: { color: "#374151" },
  qty: { fontFamily: "monospace", fontWeight: "600" },
  qtyZero: { color: "#dc2626" },
});
