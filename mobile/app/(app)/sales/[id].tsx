import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMe, useHasPermission, formatMoney } from "@/lib/use-me";
import { buildInvoiceReceipt, buildCreditNoteReceipt } from "@/lib/escpos";
import { printBytes, BluetoothPrinterError } from "@/lib/bluetooth-printer";
import { theme } from "@/lib/theme";
import { Button, Card, Field, Input } from "@/components/ui";

const PAYMENT_MODES = ["CASH", "CARD", "BANK_TRANSFER", "MOBILE_MONEY", "OTHER"];

function PrintButton({ label, onPress }: { label: string; onPress: () => Promise<void> }) {
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  return (
    <View style={{ gap: 4 }}>
      <Button
        label={label}
        variant="secondary"
        size="sm"
        isLoading={printing}
        onPress={async () => {
          setPrinting(true);
          setPrintError(null);
          try {
            await onPress();
          } catch (err) {
            setPrintError(err instanceof BluetoothPrinterError ? err.message : "Print failed.");
          } finally {
            setPrinting(false);
          }
        }}
      />
      {printError && <Text style={styles.error}>{printError}</Text>}
    </View>
  );
}

export default function SaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: me } = useMe();
  const canPay = useHasPermission("payments.record");
  const canIssueCreditNote = useHasPermission("credit_notes.issue");
  const canVoidCreditNote = useHasPermission("credit_notes.void");
  const currency = me?.companyCurrency ?? "NGN";
  const queryClient = useQueryClient();

  const { data: sale, isLoading } = useQuery({ queryKey: ["sale", id], queryFn: () => api.sale(id) });

  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("CASH");
  const [error, setError] = useState<string | null>(null);

  const [cnAmount, setCnAmount] = useState("");
  const [cnReason, setCnReason] = useState("");
  const [cnError, setCnError] = useState<string | null>(null);
  const [voidReasons, setVoidReasons] = useState<Record<string, string>>({});

  const invalidateSale = () => {
    queryClient.invalidateQueries({ queryKey: ["sale", id] });
    queryClient.invalidateQueries({ queryKey: ["sales"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const recordPayment = useMutation({
    mutationFn: () => api.recordPayment(id, { amount: Number(amount), mode }),
    onSuccess: () => {
      setAmount("");
      setError(null);
      invalidateSale();
    },
    onError: (err: Error) => setError(err.message),
  });

  const issueCreditNote = useMutation({
    mutationFn: () => api.issueCreditNote(id, { amount: Number(cnAmount), reason: cnReason }),
    onSuccess: () => {
      setCnAmount("");
      setCnReason("");
      setCnError(null);
      invalidateSale();
    },
    onError: (err: Error) => setCnError(err.message),
  });

  const voidCreditNote = useMutation({
    mutationFn: (creditNoteId: string) => api.voidCreditNote(creditNoteId, { reason: voidReasons[creditNoteId] ?? "" }),
    onSuccess: (_data, creditNoteId) => {
      setVoidReasons((prev) => ({ ...prev, [creditNoteId]: "" }));
      invalidateSale();
    },
  });

  if (isLoading || !sale) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  // Aliased so the type checker keeps `SaleDetail` (not `SaleDetail |
  // undefined`) inside the closures below — TS re-widens captures of an
  // outer `const` narrowed by an early-return guard once they cross into a
  // nested function, since it can't prove the closure runs before any
  // hypothetical reassignment; a fresh `const` sidesteps that entirely.
  const s = sale;
  const creditedTotal = s.creditNotes.filter((cn) => cn.status === "ISSUED").reduce((sum, cn) => sum + Number(cn.amount), 0);
  const outstanding = Number(s.grandTotal) - Number(s.amountPaid) - creditedTotal;
  const canRecordPayment = canPay && s.status !== "VOIDED" && s.status !== "PAID" && outstanding > 0;
  const canCreditNote = canIssueCreditNote && s.status !== "VOIDED" && outstanding > 0;

  async function printInvoice() {
    const bytes = buildInvoiceReceipt({
      saleNumber: s.saleNumber,
      companyName: me?.companyName ?? "",
      branchName: s.branchName,
      customerName: s.customerName,
      createdAt: s.createdAt,
      status: s.status,
      voidReason: s.voidReason,
      currency,
      lineItems: s.lineItems,
      subtotal: s.subtotal,
      grandTotal: s.grandTotal,
      amountPaid: s.amountPaid,
      creditedTotal: String(creditedTotal),
      outstanding: String(outstanding),
    });
    await printBytes(bytes);
  }

  async function printCreditNote(cn: (typeof s.creditNotes)[number]) {
    const bytes = buildCreditNoteReceipt({
      creditNoteNumber: cn.creditNoteNumber,
      companyName: me?.companyName ?? "",
      saleNumber: s.saleNumber,
      customerName: s.customerName,
      createdAt: cn.createdAt,
      currency,
      amount: cn.amount,
      reason: cn.reason,
      issuedByName: cn.issuedByName,
      status: cn.status,
      voidReason: cn.voidReason,
    });
    await printBytes(bytes);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.saleNumber}>{sale.saleNumber}</Text>
          <Text style={styles.muted}>
            {sale.branchName} · {sale.customerName ?? "Walk-in"}
          </Text>
        </View>
        <PrintButton label="Print invoice" onPress={printInvoice} />
      </View>

      <Card>
        <Text style={styles.cardTitle}>Line items</Text>
        {sale.lineItems.map((li, i) => (
          <View key={i} style={styles.lineRow}>
            <Text style={{ flex: 1 }}>
              {li.productName} × {li.quantity}
              {li.isService ? " (Service)" : ""}
            </Text>
            <Text>{formatMoney(li.lineTotal, currency)}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.lineRow}>
          <Text style={styles.bold}>Grand total</Text>
          <Text style={styles.bold}>{formatMoney(sale.grandTotal, currency)}</Text>
        </View>
        <View style={styles.lineRow}>
          <Text>Paid</Text>
          <Text>{formatMoney(sale.amountPaid, currency)}</Text>
        </View>
        {creditedTotal > 0 && (
          <View style={styles.lineRow}>
            <Text>Credited</Text>
            <Text>{formatMoney(creditedTotal, currency)}</Text>
          </View>
        )}
        {outstanding > 0 && sale.status !== "VOIDED" && (
          <View style={styles.lineRow}>
            <Text style={styles.outstandingLabel}>Outstanding</Text>
            <Text style={styles.outstandingLabel}>{formatMoney(outstanding, currency)}</Text>
          </View>
        )}
      </Card>

      {sale.payments.length > 0 && (
        <Card>
          <Text style={styles.cardTitle}>Payments</Text>
          {sale.payments.map((p) => (
            <View key={p.id} style={styles.lineRow}>
              <Text style={styles.muted}>
                {p.mode.replace("_", " ")} · {new Date(p.paidAt).toLocaleString()}
              </Text>
              <Text>{formatMoney(p.amount, currency)}</Text>
            </View>
          ))}
        </Card>
      )}

      {canRecordPayment && (
        <Card>
          <Text style={styles.cardTitle}>Record payment</Text>
          <Field label="Amount">
            <Input
              placeholder={`Up to ${formatMoney(outstanding, currency)}`}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
          </Field>
          <View style={styles.chipRow}>
            {PAYMENT_MODES.map((m) => (
              <Pressable key={m} onPress={() => setMode(m)} style={[styles.chip, mode === m && styles.chipSelected]}>
                <Text style={[styles.chipText, mode === m && styles.chipTextSelected]}>{m.replace("_", " ")}</Text>
              </Pressable>
            ))}
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
          <Button
            label="Record payment"
            isLoading={recordPayment.isPending}
            onPress={() => {
              setError(null);
              if (!amount) return setError("Enter an amount.");
              recordPayment.mutate();
            }}
          />
        </Card>
      )}

      {sale.creditNotes.length > 0 && (
        <Card>
          <Text style={styles.cardTitle}>Credit notes</Text>
          {sale.creditNotes.map((cn) => (
            <View key={cn.id} style={{ gap: 6 }}>
              <View style={styles.lineRow}>
                <Text style={styles.mono}>
                  {cn.creditNoteNumber} {cn.status === "VOIDED" && <Text style={styles.voidedTag}>VOIDED</Text>}
                </Text>
                <Text>{formatMoney(cn.amount, currency)}</Text>
              </View>
              <Text style={styles.muted}>{cn.reason}</Text>
              <View style={styles.row}>
                <PrintButton label="Print" onPress={() => printCreditNote(cn)} />
                {canVoidCreditNote && cn.status === "ISSUED" && (
                  <View style={{ flex: 1, gap: 6 }}>
                    <Input
                      placeholder="Void reason"
                      value={voidReasons[cn.id] ?? ""}
                      onChangeText={(text) => setVoidReasons((prev) => ({ ...prev, [cn.id]: text }))}
                    />
                    <Button
                      label="Void"
                      variant="secondary"
                      size="sm"
                      onPress={() => voidCreditNote.mutate(cn.id)}
                      isLoading={voidCreditNote.isPending}
                      disabled={!(voidReasons[cn.id] ?? "").trim()}
                    />
                  </View>
                )}
              </View>
              <View style={styles.divider} />
            </View>
          ))}
        </Card>
      )}

      {canCreditNote && (
        <Card>
          <Text style={styles.cardTitle}>Issue credit note</Text>
          <Field label="Amount">
            <Input placeholder={`Up to ${formatMoney(outstanding, currency)}`} keyboardType="decimal-pad" value={cnAmount} onChangeText={setCnAmount} />
          </Field>
          <Field label="Reason">
            <Input value={cnReason} onChangeText={setCnReason} />
          </Field>
          {cnError && <Text style={styles.error}>{cnError}</Text>}
          <Button
            label="Issue credit note"
            isLoading={issueCreditNote.isPending}
            onPress={() => {
              setCnError(null);
              if (!cnAmount) return setCnError("Enter an amount.");
              if (!cnReason.trim()) return setCnError("A reason is required.");
              issueCreditNote.mutate();
            }}
          />
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.surface },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  saleNumber: { fontSize: 20, fontWeight: "700", fontFamily: "monospace", color: theme.textPrimary },
  muted: { color: theme.textFaint },
  mono: { fontFamily: "monospace", fontSize: 12 },
  voidedTag: { color: theme.danger, fontWeight: "700" },
  cardTitle: { fontSize: theme.font.micro, fontWeight: "600", color: theme.textFaint, textTransform: "uppercase", marginBottom: 2 },
  lineRow: { flexDirection: "row", justifyContent: "space-between" },
  row: { flexDirection: "row", gap: theme.spacing.sm, alignItems: "flex-start" },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 4 },
  bold: { fontWeight: "700" },
  outstandingLabel: { color: "#b45309", fontWeight: "600" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  chip: { borderWidth: 1, borderColor: theme.borderStrong, borderRadius: theme.radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  chipSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
  chipText: { color: "#374151", fontSize: 12 },
  chipTextSelected: { color: "#fff" },
  error: { color: theme.danger, fontSize: 12 },
});
