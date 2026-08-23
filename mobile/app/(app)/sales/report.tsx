import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api, ApiRequestError, type SalesReportSummary } from "@/lib/api";
import { useMe, formatMoney } from "@/lib/use-me";
import { theme } from "@/lib/theme";
import { Button, Field, Input, Card, Badge, EmptyState, SkeletonCard, type BadgeVariant } from "@/components/ui";
import { FileText } from "lucide-react-native";

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  SUBMITTED: "warning",
  APPROVED: "success",
  SENT_BACK: "brand",
  REJECTED: "danger",
};

export default function SalesReportScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const currency = me?.companyCurrency ?? "NGN";

  const { data: preview, isLoading: previewLoading } = useQuery({ queryKey: ["sales-report-preview"], queryFn: api.todaysSalesReportPreview });
  const { data: history, isLoading: historyLoading } = useQuery({ queryKey: ["my-sales-reports"], queryFn: api.myReports });

  const branches = preview?.branches ?? [];
  const [branchId, setBranchId] = useState<string | null>(null);
  const [declaredCash, setDeclaredCash] = useState("");
  const [staffNote, setStaffNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (branches.length > 0 && branchId === null) setBranchId(branches[0].branchId);
  }, [branches, branchId]);

  const selectedBranch = useMemo(() => branches.find((b) => b.branchId === branchId), [branches, branchId]);
  // Open here means "submit is allowed": no report yet, or the Owner sent
  // the last one back for corrections. SUBMITTED/APPROVED/REJECTED all mean
  // the day is closed for this branch until an Owner acts on it.
  const isOpenForSubmission = !selectedBranch?.reportStatus || selectedBranch.reportStatus === "SENT_BACK";

  const discrepancy =
    selectedBranch && declaredCash !== "" ? Number(declaredCash) - Number(selectedBranch.cashCollected) : null;

  const submit = useMutation({
    mutationFn: () =>
      api.submitSalesReport({
        branchId: branchId!,
        declaredCash: declaredCash !== "" ? Number(declaredCash) : undefined,
        staffNote: staffNote || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-report-preview"] });
      queryClient.invalidateQueries({ queryKey: ["my-sales-reports"] });
      router.back();
    },
    onError: (err: Error) => setError(err instanceof ApiRequestError ? err.message : "Could not submit the report."),
  });

  function handleSubmit() {
    setError(null);
    if (!branchId) return setError("Select a branch.");
    submit.mutate();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      {previewLoading ? (
        <SkeletonCard />
      ) : branches.length === 0 ? (
        <Text style={styles.muted}>No branches yet — create one on the web app first.</Text>
      ) : (
        <>
          {branches.length > 1 && (
            <View>
              <Text style={styles.label}>Branch</Text>
              <View style={styles.chipRow}>
                {branches.map((b) => (
                  <Pressable key={b.branchId} onPress={() => setBranchId(b.branchId)} style={[styles.chip, branchId === b.branchId && styles.chipSelected]}>
                    <Text style={[styles.chipText, branchId === b.branchId && styles.chipTextSelected]}>{b.branchName}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {selectedBranch && (
            <Card style={{ gap: theme.spacing.sm }}>
              <View style={styles.statRow}>
                <Text style={styles.muted}>Sales today</Text>
                <Text style={styles.statValue}>{selectedBranch.salesCount}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.muted}>Gross total</Text>
                <Text style={styles.statValue}>{formatMoney(selectedBranch.grossSalesTotal, currency)}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.muted}>Payments collected</Text>
                <Text style={styles.statValue}>{formatMoney(selectedBranch.paymentsCollected, currency)}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.muted}>Cash collected (system)</Text>
                <Text style={styles.statValue}>{formatMoney(selectedBranch.cashCollected, currency)}</Text>
              </View>
            </Card>
          )}

          {selectedBranch && !isOpenForSubmission && (
            <Card style={{ gap: theme.spacing.xs }}>
              <Badge variant={STATUS_VARIANTS[selectedBranch.reportStatus!] ?? "neutral"} label={selectedBranch.reportStatus!.replace("_", " ")} />
              <Text style={styles.muted}>
                Today&apos;s report for this branch has already been submitted. Manage it on the web app, or wait for an
                Owner to review it.
              </Text>
            </Card>
          )}

          {selectedBranch && isOpenForSubmission && (
            <>
              <Field label="Cash counted (optional)">
                <Input keyboardType="decimal-pad" placeholder="0.00" value={declaredCash} onChangeText={setDeclaredCash} />
              </Field>
              {discrepancy !== null && Math.abs(discrepancy) > 0.01 && (
                <Text style={styles.warning}>
                  That&apos;s {formatMoney(Math.abs(discrepancy), currency)} {discrepancy > 0 ? "more" : "less"} than the
                  system shows was collected in cash. This will be flagged for the Owner.
                </Text>
              )}
              <Field label="Note (optional)">
                <Input placeholder="Anything unusual today?" value={staffNote} onChangeText={setStaffNote} multiline numberOfLines={3} />
              </Field>
              {error && <Text style={styles.error}>{error}</Text>}
              <Button label="Submit today's report" onPress={handleSubmit} isLoading={submit.isPending} />
            </>
          )}
        </>
      )}

      <View>
        <Text style={styles.label}>Recent reports</Text>
        {historyLoading ? (
          <SkeletonCard />
        ) : (history?.reports.length ?? 0) === 0 ? (
          <EmptyState icon={FileText} title="No reports yet" />
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {history!.reports.map((r) => (
              <ReportHistoryRow key={r.id} report={r} currency={currency} />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function ReportHistoryRow({ report, currency }: { report: SalesReportSummary; currency: string }) {
  return (
    <Card style={{ gap: 4 }}>
      <View style={styles.statRow}>
        <Text style={styles.statValue}>
          {report.branchName} · {report.reportDate}
        </Text>
        <Badge variant={STATUS_VARIANTS[report.status] ?? "neutral"} label={report.status.replace("_", " ")} />
      </View>
      <Text style={styles.muted}>
        {report.salesCount} sale{report.salesCount === 1 ? "" : "s"} · {formatMoney(report.grossSalesTotal, currency)}
      </Text>
      {report.cashDiscrepancy && Number(report.cashDiscrepancy) !== 0 && (
        <Text style={styles.warning}>Discrepancy: {formatMoney(report.cashDiscrepancy, currency)}</Text>
      )}
      {report.ownerNote && <Text style={styles.muted}>Owner: &ldquo;{report.ownerNote}&rdquo;</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.surface },
  label: { fontSize: theme.font.caption, fontWeight: "600", color: theme.textMuted, marginBottom: 6, textTransform: "uppercase" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  chip: { borderWidth: 1, borderColor: theme.borderStrong, borderRadius: theme.radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  chipSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
  chipText: { color: "#374151" },
  chipTextSelected: { color: "#fff" },
  muted: { color: theme.textFaint, fontSize: theme.font.caption },
  statRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statValue: { fontWeight: "600", color: theme.textPrimary },
  warning: { color: theme.warning, fontSize: theme.font.caption },
  error: { color: theme.danger },
});
