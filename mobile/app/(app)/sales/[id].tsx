import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMe, useHasPermission, formatMoney } from "@/lib/use-me";
import { buildInvoiceReceipt, buildCreditNoteReceipt } from "@/lib/escpos";
import { printBytes, BluetoothPrinterError } from "@/lib/bluetooth-printer";

const PAYMENT_MODES = ["CASH", "CARD", "BANK_TRANSFER", "MOBILE_MONEY", "OTHER"];

function PrintButton({ label, onPress }: { label: string; onPress: () => Promise<void> }) {
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  return (
    <View style={{ gap: 4 }}>
      <Pressable
        style={styles.printButton}
        disabled={printing}
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
      >
        {printing ? <ActivityIndicator size="small" /> : <Text style={styles.printButtonText}>{label}</Text>}
      </Pressable>
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
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.saleNumber}>{sale.saleNumber}</Text>
          <Text style={styles.muted}>
            {sale.branchName} · {sale.customerName ?? "Walk-in"}
          </Text>
        </View>
        <PrintButton label="Print invoice" onPress={printInvoice} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Line items</Text>
        {sale.lineItems.map((li, i) => (
          <View key={i} style={styles.lineRow}>
            <Text style={{ flex: 1 }}>
              {li.productName} × {li.quantity}
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
      </View>

      {sale.payments.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payments</Text>
          {sale.payments.map((p) => (
            <View key={p.id} style={styles.lineRow}>
              <Text style={styles.muted}>
                {p.mode.replace("_", " ")} · {new Date(p.paidAt).toLocaleString()}
              </Text>
              <Text>{formatMoney(p.amount, currency)}</Text>
            </View>
          ))}
        </View>
      )}

      {canRecordPayment && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Record payment</Text>
          <TextInput
            style={styles.input}
            placeholder={`Amount (up to ${formatMoney(outstanding, currency)})`}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />
          <View style={styles.chipRow}>
            {PAYMENT_MODES.map((m) => (
              <Pressable key={m} onPress={() => setMode(m)} style={[styles.chip, mode === m && styles.chipSelected]}>
                <Text style={[styles.chipText, mode === m && styles.chipTextSelected]}>{m.replace("_", " ")}</Text>
              </Pressable>
            ))}
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            style={styles.submitButton}
            onPress={() => {
              setError(null);
              if (!amount) return setError("Enter an amount.");
              recordPayment.mutate();
            }}
            disabled={recordPayment.isPending}
          >
            {recordPayment.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Record payment</Text>}
          </Pressable>
        </View>
      )}

      {sale.creditNotes.length > 0 && (
        <View style={styles.card}>
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
                    <TextInput
                      style={styles.input}
                      placeholder="Void reason"
                      value={voidReasons[cn.id] ?? ""}
                      onChangeText={(text) => setVoidReasons((prev) => ({ ...prev, [cn.id]: text }))}
                    />
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => voidCreditNote.mutate(cn.id)}
                      disabled={voidCreditNote.isPending || !(voidReasons[cn.id] ?? "").trim()}
                    >
                      <Text style={styles.secondaryButtonText}>Void</Text>
                    </Pressable>
                  </View>
                )}
              </View>
              <View style={styles.divider} />
            </View>
          ))}
        </View>
      )}

      {canCreditNote && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Issue credit note</Text>
          <TextInput
            style={styles.input}
            placeholder={`Amount (up to ${formatMoney(outstanding, currency)})`}
            keyboardType="decimal-pad"
            value={cnAmount}
            onChangeText={setCnAmount}
          />
          <TextInput style={styles.input} placeholder="Reason" value={cnReason} onChangeText={setCnReason} />
          {cnError && <Text style={styles.error}>{cnError}</Text>}
          <Pressable
            style={styles.submitButton}
            onPress={() => {
              setCnError(null);
              if (!cnAmount) return setCnError("Enter an amount.");
              if (!cnReason.trim()) return setCnError("A reason is required.");
              issueCreditNote.mutate();
            }}
            disabled={issueCreditNote.isPending}
          >
            {issueCreditNote.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Issue credit note</Text>}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  saleNumber: { fontSize: 20, fontWeight: "700", fontFamily: "monospace" },
  muted: { color: "#9ca3af" },
  mono: { fontFamily: "monospace", fontSize: 12 },
  voidedTag: { color: "#dc2626", fontWeight: "700" },
  card: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 14, gap: 8 },
  cardTitle: { fontSize: 11, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase", marginBottom: 2 },
  lineRow: { flexDirection: "row", justifyContent: "space-between" },
  row: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  divider: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 4 },
  bold: { fontWeight: "700" },
  outstandingLabel: { color: "#b45309", fontWeight: "600" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipSelected: { backgroundColor: "#171717", borderColor: "#171717" },
  chipText: { color: "#374151", fontSize: 12 },
  chipTextSelected: { color: "#fff" },
  error: { color: "#dc2626", fontSize: 12 },
  submitButton: { backgroundColor: "#171717", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  submitButtonText: { color: "#fff", fontWeight: "600" },
  secondaryButton: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  secondaryButtonText: { color: "#374151", fontWeight: "600" },
  printButton: { borderWidth: 1, borderColor: "#171717", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  printButtonText: { color: "#171717", fontWeight: "600", fontSize: 12 },
});
