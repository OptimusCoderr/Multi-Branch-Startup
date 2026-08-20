import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMe, formatMoney } from "@/lib/use-me";

export default function DashboardScreen() {
  const { data: me } = useMe();
  const { data, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });
  const currency = me?.companyCurrency ?? "NGN";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <Text style={styles.title}>{me?.companyName ?? "Dashboard"}</Text>
      <Text style={styles.subtitle}>{me?.roleName ?? ""}</Text>

      {isLoading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : (
        data && (
          <View style={styles.grid}>
            <Card label="Today's sales" value={String(data.todaysSalesCount)} />
            <Card label="Today's sales total" value={formatMoney(data.todaysSalesTotal, currency)} />
            <Card label="Outstanding debt" value={formatMoney(data.totalOutstandingDebt, currency)} highlight />
            <Card label="Debtors" value={String(data.debtorCount)} />
          </View>
        )
      )}
    </ScrollView>
  );
}

function Card({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={[styles.cardValue, highlight && styles.cardValueHighlight]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, gap: 16 },
  title: { fontSize: 24, fontWeight: "700" },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: -8 },
  muted: { color: "#9ca3af" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { flexBasis: "47%", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 14, gap: 4 },
  cardLabel: { fontSize: 11, textTransform: "uppercase", color: "#9ca3af", fontWeight: "600" },
  cardValue: { fontSize: 18, fontWeight: "700" },
  cardValueHighlight: { color: "#b45309" },
});
