import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { ScanLine, PackageSearch } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api, type StockProduct } from "@/lib/api";
import { useHasPermission, formatQuantity } from "@/lib/use-me";
import { theme } from "@/lib/theme";
import { Button, Card, Badge, EmptyState, SkeletonCard } from "@/components/ui";

export default function StockScreen() {
  const canCount = useHasPermission("stock_levels.view");
  const { data, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["stock"], queryFn: api.stock });

  return (
    <View style={styles.container}>
      {canCount && (
        <View style={styles.countButtonWrap}>
          <Link href="/stock-count" asChild>
            <Button label="Stock count" icon={ScanLine} />
          </Link>
        </View>
      )}
      {isLoading ? (
        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <FlatList
          data={data?.products ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={<EmptyState icon={PackageSearch} title="No products yet" />}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
          renderItem={({ item, index }: { item: StockProduct; index: number }) => {
            const totalStock =
              item.branchStocks.reduce((sum, s) => sum + s.quantity, 0) + item.warehouseStocks.reduce((sum, s) => sum + s.quantity, 0);
            return (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 30)}>
                <Card>
                  <View style={styles.headerRow}>
                    <Text style={styles.productName}>
                      {item.name} <Text style={styles.sku}>({item.sku})</Text>
                    </Text>
                    {totalStock === 0 && <Badge variant="danger" label="Out of stock" />}
                  </View>
                  {item.branchStocks.map((s) => (
                    <View key={s.branchId} style={styles.row}>
                      <Text style={styles.location}>{s.branchName}</Text>
                      <Text style={[styles.qty, s.quantity === 0 && styles.qtyZero]}>{formatQuantity(s.quantity, item.unitLabel)}</Text>
                    </View>
                  ))}
                  {item.warehouseStocks.map((s) => (
                    <View key={s.warehouseId} style={styles.row}>
                      <Text style={styles.location}>{s.warehouseName} (warehouse)</Text>
                      <Text style={[styles.qty, s.quantity === 0 && styles.qtyZero]}>{formatQuantity(s.quantity, item.unitLabel)}</Text>
                    </View>
                  ))}
                </Card>
              </Animated.View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.surface },
  countButtonWrap: { padding: theme.spacing.lg, paddingBottom: 0 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  productName: { fontWeight: "600", color: theme.textPrimary },
  sku: { fontFamily: "monospace", fontWeight: "400", color: theme.textFaint, fontSize: theme.font.caption },
  row: { flexDirection: "row", justifyContent: "space-between" },
  location: { color: "#374151" },
  qty: { fontFamily: "monospace", fontWeight: "600", color: theme.textPrimary },
  qtyZero: { color: theme.danger },
});
