import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { api, type CustomerSummary } from "@/lib/api";
import { useMe, useHasPermission, formatMoney } from "@/lib/use-me";

export default function CustomersListScreen() {
  const { data: me } = useMe();
  const canManage = useHasPermission("customers.manage");
  const { data, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["customers"], queryFn: api.customers });
  const currency = me?.companyCurrency ?? "NGN";

  return (
    <View style={styles.container}>
      {canManage && (
        <Link href="/customers/new" asChild>
          <Pressable style={styles.newButton}>
            <Text style={styles.newButtonText}>+ New customer</Text>
          </Pressable>
        </Link>
      )}

      {isLoading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : (
        <FlatList
          data={data?.customers ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={<Text style={styles.muted}>No customers yet.</Text>}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }: { item: CustomerSummary }) => (
            <Link href={`/customers/${item.id}`} asChild>
              <Pressable style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.subtitle}>{item.phone ?? "No phone"}</Text>
                </View>
                {Number(item.outstanding) > 0 ? (
                  <Text style={[styles.outstanding, item.overdueSaleCount > 0 && styles.overdue]}>
                    {formatMoney(item.outstanding, currency)}
                    {item.overdueSaleCount > 0 ? " (overdue)" : ""}
                  </Text>
                ) : (
                  <Text style={styles.muted}>—</Text>
                )}
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
  name: { fontWeight: "600" },
  outstanding: { color: "#b45309", fontWeight: "600" },
  overdue: { color: "#dc2626" },
});
