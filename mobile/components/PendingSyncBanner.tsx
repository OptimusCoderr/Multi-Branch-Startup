import { View, Text, StyleSheet } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudOff } from "lucide-react-native";
import { theme } from "@/lib/theme";
import { listPending, removePending, syncPending } from "@/lib/offline-queue";
import { Card, Button } from "@/components/ui";

/**
 * Surfaces sales recorded while offline that are still waiting to reach the
 * server, plus any that came back rejected once actually synced (stock ran
 * out in the meantime, that day's report was already submitted, etc.) so
 * they don't sit invisible in local storage forever.
 */
export function PendingSyncBanner() {
  const queryClient = useQueryClient();
  const { data: pending } = useQuery({ queryKey: ["offline-queue"], queryFn: listPending, refetchInterval: 5000 });

  const items = pending ?? [];
  if (items.length === 0) return null;

  const failed = items.filter((p) => p.error);
  const STALE_MS = 12 * 60 * 60 * 1000;
  const oldestQueuedAt = Math.min(...items.map((p) => p.queuedAt));
  const isStale = Date.now() - oldestQueuedAt > STALE_MS;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["offline-queue"] });
    queryClient.invalidateQueries({ queryKey: ["sales"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function handleSyncNow() {
    await syncPending();
    invalidate();
  }

  async function handleDiscard(clientRequestId: string) {
    await removePending(clientRequestId);
    invalidate();
  }

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <CloudOff size={16} color={theme.warning} />
        <Text style={styles.title}>
          {items.length} sale{items.length === 1 ? "" : "s"} waiting to sync
        </Text>
      </View>
      {isStale && (
        <Text style={styles.staleText}>
          These have been waiting a while — they&apos;re only safely backed up once synced. Try to get back online
          soon, especially before switching phones.
        </Text>
      )}
      <Button label="Sync now" variant="secondary" size="sm" onPress={handleSyncNow} />
      {failed.map((p) => (
        <View key={p.clientRequestId} style={styles.failedRow}>
          <Text style={styles.failedText}>{p.error}</Text>
          <Button label="Discard" variant="ghost" size="sm" onPress={() => handleDiscard(p.clientRequestId)} />
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.lg, borderColor: theme.warning },
  header: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  title: { fontWeight: "600", color: theme.textPrimary, fontSize: theme.font.body },
  failedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: theme.spacing.xs,
  },
  failedText: { flex: 1, color: theme.danger, fontSize: theme.font.caption },
  staleText: { color: theme.danger, fontSize: theme.font.caption },
});
