import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, Wallet, Users } from "lucide-react-native";
import { api } from "@/lib/api";
import { useMe, formatMoney } from "@/lib/use-me";
import { theme } from "@/lib/theme";
import { StatCard, SkeletonCard } from "@/components/ui";

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
        <View style={styles.grid}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        data && (
          <View style={styles.grid}>
            <StatCard icon={ShoppingCart} tint={theme.primary} label="Today's sales" value={String(data.todaysSalesCount)} />
            <StatCard icon={ShoppingCart} tint={theme.success} label="Today's sales total" value={formatMoney(data.todaysSalesTotal, currency)} />
            <StatCard icon={Wallet} tint={theme.warning} label="Outstanding debt" value={formatMoney(data.totalOutstandingDebt, currency)} highlight />
            <StatCard icon={Users} tint={theme.secondary} label="Debtors" value={String(data.debtorCount)} />
          </View>
        )
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.surface },
  content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  header: { borderRadius: theme.radius.xl, padding: 18, gap: 2 },
  title: { fontSize: theme.font.display, fontWeight: "700", color: "#fff" },
  subtitle: { fontSize: theme.font.caption, color: "rgba(255,255,255,0.85)" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md },
});
