import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Receipt } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api, type SaleSummary } from "@/lib/api";
import { useMe, useHasPermission, formatMoney } from "@/lib/use-me";
import { theme } from "@/lib/theme";
import { Button, ListItem, Badge, EmptyState, SkeletonCard, type BadgeVariant } from "@/components/ui";

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  CONFIRMED: "warning",
  PARTIALLY_PAID: "brand",
  PAID: "success",
  VOIDED: "neutral",
};

export default function SalesListScreen() {
  const { data: me } = useMe();
  const canRecord = useHasPermission("sales.record");
  const { data, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["sales"], queryFn: api.sales });
  const currency = me?.companyCurrency ?? "NGN";

  return (
    <View style={styles.container}>
      {canRecord && (
        <View style={styles.newButtonWrap}>
          <Link href="/sales/new" asChild>
            <Button label="Record sale" />
          </Link>
        </View>
      )}

      {isLoading ? (
        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <FlatList
          data={data?.sales ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={<EmptyState icon={Receipt} title="No sales yet" />}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}
          renderItem={({ item, index }: { item: SaleSummary; index: number }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 30)}>
              <Link href={`/sales/${item.id}`} asChild>
                <ListItem
                  title={item.saleNumber}
                  subtitle={`${item.branchName} · ${item.customerName ?? "Walk-in"}`}
                  trailing={
                    <View style={{ gap: 4, alignItems: "flex-end" }}>
                      <Text style={styles.amount}>{formatMoney(item.grandTotal, currency)}</Text>
                      <Badge variant={STATUS_VARIANTS[item.status] ?? "neutral"} label={item.status.replace("_", " ")} />
                    </View>
                  }
                />
              </Link>
            </Animated.View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.surface },
  newButtonWrap: { padding: theme.spacing.lg, paddingBottom: 0 },
  amount: { fontWeight: "600", color: theme.textPrimary },
});
