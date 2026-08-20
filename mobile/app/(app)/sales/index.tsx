import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { api, type SaleSummary } from "@/lib/api";
import { useMe, useHasPermission, formatMoney } from "@/lib/use-me";

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "#a16207",
  PARTIALLY_PAID: "#1d4ed8",
  PAID: "#15803d",
  VOIDED: "#6b7280",
};

export default function SalesListScreen() {
  const { data: me } = useMe();
  const canRecord = useHasPermission("sales.record");
  const { data, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["sales"], queryFn: api.sales });
  const currency = me?.companyCurrency ?? "NGN";

  return (
    <View style={styles.container}>
      {canRecord && (
        <Link href="/sales/new" asChild>
          <Pressable style={styles.newButton}>
            <Text style={styles.newButtonText}>+ Record sale</Text>
          </Pressable>
        </Link>
      )}

      {isLoading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : (
        <FlatList
          data={data?.sales ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={<Text style={styles.muted}>No sales yet.</Text>}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }: { item: SaleSummary }) => (
            <Link href={`/sales/${item.id}`} asChild>
              <Pressable style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.saleNumber}>{item.saleNumber}</Text>
                  <Text style={styles.subtitle}>
                    {item.branchName} · {item.customerName ?? "Walk-in"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.amount}>{formatMoney(item.grandTotal, currency)}</Text>
                  <Text style={[styles.status, { color: STATUS_COLORS[item.status] ?? "#374151" }]}>{item.status.replace("_", " ")}</Text>
                </View>
              </Pressable>
            </Link>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  newButton: { backgroundColor: "#171717", margin: 16, marginBottom: 0, borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  newButtonText: { color: "#fff", fontWeight: "600" },
  muted: { color: "#9ca3af", padding: 16 },
  subtitle: { color: "#9ca3af" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
  },
  saleNumber: { fontWeight: "600", fontFamily: "monospace" },
  amount: { fontWeight: "600" },
  status: { fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
});
