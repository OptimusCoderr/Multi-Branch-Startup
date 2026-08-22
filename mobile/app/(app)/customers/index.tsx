import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Users } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api, type CustomerSummary } from "@/lib/api";
import { useMe, useHasPermission, formatMoney } from "@/lib/use-me";
import { theme } from "@/lib/theme";
import { Button, ListItem, EmptyState, SkeletonCard } from "@/components/ui";

export default function CustomersListScreen() {
  const { data: me } = useMe();
  const canManage = useHasPermission("customers.manage");
  const { data, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["customers"], queryFn: api.customers });
  const currency = me?.companyCurrency ?? "NGN";

  return (
    <View style={styles.container}>
      {canManage && (
        <View style={styles.newButtonWrap}>
          <Link href="/customers/new" asChild>
            <Button label="New customer" />
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
          data={data?.customers ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={<EmptyState icon={Users} title="No customers yet" />}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}
          renderItem={({ item, index }: { item: CustomerSummary; index: number }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 30)}>
              <Link href={`/customers/${item.id}`} asChild>
                <ListItem
                  title={item.name}
                  subtitle={item.phone ?? "No phone"}
                  trailing={
                    Number(item.outstanding) > 0 ? (
                      <Text style={[styles.outstanding, item.overdueSaleCount > 0 && styles.overdue]}>
                        {formatMoney(item.outstanding, currency)}
                        {item.overdueSaleCount > 0 ? " (overdue)" : ""}
                      </Text>
                    ) : (
                      <Text style={styles.muted}>—</Text>
                    )
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
  muted: { color: theme.textFaint },
  outstanding: { color: "#b45309", fontWeight: "600" },
  overdue: { color: theme.danger },
});
