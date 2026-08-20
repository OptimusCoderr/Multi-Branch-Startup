import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, Wallet, Users } from "lucide-react-native";
import { api } from "@/lib/api";
import { useMe, formatMoney } from "@/lib/use-me";
import { theme } from "@/lib/theme";

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
      <LinearGradient colors={theme.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <Text style={styles.title}>{me?.companyName ?? "Dashboard"}</Text>
        <Text style={styles.subtitle}>{me?.roleName ?? ""}</Text>
      </LinearGradient>

      {isLoading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : (
        data && (
          <View style={styles.grid}>
            <Card icon={ShoppingCart} tint={theme.primary} label="Today's sales" value={String(data.todaysSalesCount)} />
            <Card icon={ShoppingCart} tint={theme.success} label="Today's sales total" value={formatMoney(data.todaysSalesTotal, currency)} />
            <Card icon={Wallet} tint={theme.warning} label="Outstanding debt" value={formatMoney(data.totalOutstandingDebt, currency)} highlight />
            <Card icon={Users} tint={theme.secondary} label="Debtors" value={String(data.debtorCount)} />
          </View>
        )
      )}
    </ScrollView>
  );
}

function Card({
  icon: Icon,
  tint,
  label,
  value,
  highlight,
}: {
  icon: typeof ShoppingCart;
  tint: string;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.card}>
      <View style={[styles.iconChip, { backgroundColor: `${tint}1a` }]}>
        <Icon color={tint} size={18} strokeWidth={2.25} />
      </View>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={[styles.cardValue, highlight && styles.cardValueHighlight]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, gap: 16 },
  header: { borderRadius: 16, padding: 18, gap: 2 },
  title: { fontSize: 22, fontWeight: "700", color: "#fff" },
  subtitle: { fontSize: 13, color: "rgba(255,255,255,0.85)" },
  muted: { color: "#9ca3af" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    flexBasis: "47%",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 14,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  iconChip: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardLabel: { fontSize: 11, textTransform: "uppercase", color: "#9ca3af", fontWeight: "600" },
  cardValue: { fontSize: 18, fontWeight: "700" },
  cardValueHighlight: { color: theme.warning },
});
