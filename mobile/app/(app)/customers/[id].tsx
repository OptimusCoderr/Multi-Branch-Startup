import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams, Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMe, formatMoney } from "@/lib/use-me";

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: me } = useMe();
  const currency = me?.companyCurrency ?? "NGN";
  const { data: customer, isLoading } = useQuery({ queryKey: ["customer", id], queryFn: () => api.customer(id) });

  if (isLoading || !customer) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View>
        <Text style={styles.name}>{customer.name}</Text>
        <Text style={styles.muted}>
          {customer.phone ?? "No phone"} {customer.email ? `· ${customer.email}` : ""}
        </Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Outstanding</Text>
          <Text style={[styles.cardValue, Number(customer.outstanding) > 0 && styles.outstanding]}>
            {formatMoney(customer.outstanding, currency)}
          </Text>
          {customer.overdueSaleCount > 0 && <Text style={styles.overdueNote}>{customer.overdueSaleCount} sale(s) overdue</Text>}
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Open sales</Text>
          <Text style={styles.cardValue}>{customer.openSaleCount}</Text>
        </View>
      </View>

      <View>
        <Text style={styles.sectionLabel}>Sales history</Text>
        {customer.sales.length === 0 ? (
          <Text style={styles.muted}>No sales yet.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {customer.sales.map((s) => {
              const outstanding = Number(s.grandTotal) - Number(s.amountPaid);
              return (
                <Link key={s.id} href={`/sales/${s.id}`} asChild>
                  <View style={styles.saleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.saleNumber}>{s.saleNumber}</Text>
                      <Text style={styles.muted}>{s.branchName}</Text>
                    </View>
                    <Text style={outstanding > 0 ? styles.outstanding : undefined}>{formatMoney(s.grandTotal, currency)}</Text>
                  </View>
                </Link>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 20, fontWeight: "700" },
  muted: { color: "#9ca3af" },
  grid: { flexDirection: "row", gap: 12 },
  card: { flex: 1, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 12, gap: 4 },
  cardLabel: { fontSize: 11, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase" },
  cardValue: { fontSize: 18, fontWeight: "700" },
  outstanding: { color: "#b45309" },
  overdueNote: { fontSize: 11, color: "#dc2626", fontWeight: "600" },
  sectionLabel: { fontSize: 11, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase", marginBottom: 8 },
  saleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
  },
  saleNumber: { fontWeight: "600", fontFamily: "monospace" },
});
