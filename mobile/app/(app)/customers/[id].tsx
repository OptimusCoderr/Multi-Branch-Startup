import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams, Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Receipt } from "lucide-react-native";
import { api } from "@/lib/api";
import { useMe, formatMoney } from "@/lib/use-me";
import { theme } from "@/lib/theme";
import { Card, ListItem, EmptyState } from "@/components/ui";

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
    <ScrollView style={styles.container} contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <View>
        <Text style={styles.name}>{customer.name}</Text>
        <Text style={styles.muted}>
          {customer.phone ?? "No phone"} {customer.email ? `· ${customer.email}` : ""}
        </Text>
      </View>

      <View style={styles.grid}>
        <Card style={{ flex: 1 }}>
          <Text style={styles.cardLabel}>Outstanding</Text>
          <Text style={[styles.cardValue, Number(customer.outstanding) > 0 && styles.outstanding]}>
            {formatMoney(customer.outstanding, currency)}
          </Text>
          {customer.overdueSaleCount > 0 && <Text style={styles.overdueNote}>{customer.overdueSaleCount} sale(s) overdue</Text>}
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={styles.cardLabel}>Open sales</Text>
          <Text style={styles.cardValue}>{customer.openSaleCount}</Text>
        </Card>
      </View>

      <View>
        <Text style={styles.sectionLabel}>Sales history</Text>
        {customer.sales.length === 0 ? (
          <EmptyState icon={Receipt} title="No sales yet" />
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {customer.sales.map((s) => {
              const outstanding = Number(s.grandTotal) - Number(s.amountPaid);
              return (
                <Link key={s.id} href={`/sales/${s.id}`} asChild>
                  <ListItem
                    title={s.saleNumber}
                    subtitle={s.branchName}
                    trailing={
                      <Text style={outstanding > 0 ? styles.outstanding : styles.amount}>{formatMoney(s.grandTotal, currency)}</Text>
                    }
                  />
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
  container: { flex: 1, backgroundColor: theme.surface },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  name: { fontSize: theme.font.display, fontWeight: "700", color: theme.textPrimary },
  muted: { color: theme.textFaint },
  grid: { flexDirection: "row", gap: theme.spacing.md },
  cardLabel: { fontSize: theme.font.micro, fontWeight: "600", color: theme.textFaint, textTransform: "uppercase" },
  cardValue: { fontSize: theme.font.h1, fontWeight: "700", color: theme.textPrimary },
  amount: { color: theme.textPrimary },
  outstanding: { color: "#b45309" },
  overdueNote: { fontSize: theme.font.micro, color: theme.danger, fontWeight: "600" },
  sectionLabel: { fontSize: theme.font.micro, fontWeight: "600", color: theme.textFaint, textTransform: "uppercase", marginBottom: 8 },
});
