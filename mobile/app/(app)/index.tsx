import { View, Text, Pressable, StyleSheet, ScrollView, RefreshControl, Share } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, Wallet, Users, Share2 } from "lucide-react-native";
import { api } from "@/lib/api";
import { useMe, formatMoney } from "@/lib/use-me";
import { theme } from "@/lib/theme";
import { StatCard, SkeletonCard, Card } from "@/components/ui";

export default function DashboardScreen() {
  const { data: me } = useMe();
  const { data, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });
  const currency = me?.companyCurrency ?? "NGN";

  async function shareSummary() {
    if (!data) return;
    const dateLabel = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const message = [
      `${data.companyName} — ${dateLabel}`,
      `Sales: ${formatMoney(data.todaysSalesTotal, currency)} (${data.todaysSalesCount} sale${data.todaysSalesCount === 1 ? "" : "s"})`,
      `Expenses: ${formatMoney(data.todaysExpensesTotal, currency)}`,
      `Profit: ${formatMoney(data.todaysProfit, currency)}`,
      `Owed to you: ${formatMoney(data.totalOutstandingDebt, currency)}`,
    ].join("\n");
    try {
      await Share.share({ message });
    } catch {
      // The user backing out of the share sheet also lands here — nothing to do.
    }
  }

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
        <View style={{ gap: theme.spacing.lg }}>
          <SkeletonCard />
          <View style={styles.grid}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        </View>
      ) : (
        data && (
          <>
            <Card style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryTitle}>Today&apos;s summary</Text>
                <Pressable onPress={shareSummary} style={styles.shareButton}>
                  <Share2 size={14} color={theme.primary} />
                  <Text style={styles.shareButtonText}>Share</Text>
                </Pressable>
              </View>
              <View style={styles.summaryGrid}>
                <View>
                  <Text style={styles.summaryLabel}>Sales</Text>
                  <Text style={styles.summaryValue}>{formatMoney(data.todaysSalesTotal, currency)}</Text>
                </View>
                <View>
                  <Text style={styles.summaryLabel}>Expenses</Text>
                  <Text style={styles.summaryValue}>{formatMoney(data.todaysExpensesTotal, currency)}</Text>
                </View>
                <View>
                  <Text style={styles.summaryLabel}>Profit</Text>
                  <Text style={[styles.summaryValue, { color: data.todaysProfit.startsWith("-") ? theme.danger : theme.success }]}>
                    {formatMoney(data.todaysProfit, currency)}
                  </Text>
                </View>
                <View>
                  <Text style={styles.summaryLabel}>Owed to you</Text>
                  <Text style={[styles.summaryValue, { color: theme.warning }]}>{formatMoney(data.totalOutstandingDebt, currency)}</Text>
                </View>
              </View>
            </Card>

            <View style={styles.grid}>
              <StatCard icon={ShoppingCart} tint={theme.primary} label="Today's sales" value={String(data.todaysSalesCount)} />
              <StatCard icon={ShoppingCart} tint={theme.success} label="Today's sales total" value={formatMoney(data.todaysSalesTotal, currency)} />
              <StatCard icon={Wallet} tint={theme.warning} label="Outstanding debt" value={formatMoney(data.totalOutstandingDebt, currency)} highlight />
              <StatCard icon={Users} tint={theme.secondary} label="Debtors" value={String(data.debtorCount)} />
            </View>
          </>
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
  summaryCard: { gap: theme.spacing.sm },
  summaryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  summaryTitle: { fontSize: theme.font.h2, fontWeight: "700", color: theme.textPrimary },
  shareButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 8 },
  shareButtonText: { color: theme.primary, fontWeight: "600", fontSize: theme.font.caption },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.lg },
  summaryLabel: { fontSize: theme.font.micro, color: theme.textFaint },
  summaryValue: { fontSize: theme.font.body, fontWeight: "700", color: theme.textPrimary },
});
