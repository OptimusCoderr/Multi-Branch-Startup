import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from "react-native";
import {
  requestBluetoothPermissions,
  scanForPrinters,
  pairPrinter,
  getSavedPrinter,
  clearSavedPrinter,
  printBytes,
  BluetoothPrinterError,
  type ScannedDevice,
  type SavedPrinter,
} from "@/lib/bluetooth-printer";
import { ReceiptBuilder } from "@/lib/escpos";
import { signOut } from "@/lib/auth-client";

export default function PrinterSettingsScreen() {
  const [savedPrinter, setSavedPrinter] = useState<SavedPrinter | null | undefined>(undefined);
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<ScannedDevice[]>([]);
  const [pairingId, setPairingId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSavedPrinter().then(setSavedPrinter);
  }, []);

  async function startScan() {
    setError(null);
    setDevices([]);
    const granted = await requestBluetoothPermissions();
    if (!granted) {
      setError("Bluetooth permission was denied. Enable it in system settings to pair a printer.");
      return;
    }
    setScanning(true);
    try {
      const stop = scanForPrinters((device) => {
        setDevices((prev) => (prev.some((d) => d.id === device.id) ? prev : [...prev, device]));
      }, 8000);
      setTimeout(() => {
        stop();
        setScanning(false);
      }, 8000);
    } catch (err) {
      setScanning(false);
      setError(err instanceof Error ? err.message : "Could not start scanning.");
    }
  }

  async function handlePair(device: ScannedDevice) {
    setPairingId(device.id);
    setError(null);
    try {
      const saved = await pairPrinter(device.id, device.name);
      setSavedPrinter(saved);
      setDevices([]);
    } catch (err) {
      setError(err instanceof BluetoothPrinterError ? err.message : "Could not pair with this device.");
    } finally {
      setPairingId(null);
    }
  }

  async function handleForget() {
    await clearSavedPrinter();
    setSavedPrinter(null);
  }

  async function handleTestPrint() {
    setTesting(true);
    setError(null);
    try {
      const bytes = new ReceiptBuilder(32)
        .align("center")
        .bold(true)
        .text("Test print")
        .bold(false)
        .text("Printer connection is working.")
        .cut()
        .toBytes();
      await printBytes(bytes);
    } catch (err) {
      setError(err instanceof BluetoothPrinterError ? err.message : "Test print failed.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={{ padding: 16, gap: 16 }}>
        <View>
          <Text style={styles.title}>Receipt printer</Text>
          <Text style={styles.muted}>Pair a Bluetooth thermal receipt printer to print invoices and credit notes.</Text>
        </View>

        {savedPrinter === undefined ? (
          <ActivityIndicator />
        ) : savedPrinter ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Paired printer</Text>
            <Text style={styles.deviceName}>{savedPrinter.deviceName}</Text>
            <View style={styles.row}>
              <Pressable style={styles.secondaryButton} onPress={handleTestPrint} disabled={testing}>
                {testing ? <ActivityIndicator /> : <Text style={styles.secondaryButtonText}>Test print</Text>}
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={handleForget}>
                <Text style={styles.secondaryButtonText}>Forget</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No printer paired</Text>
            <Pressable style={styles.submitButton} onPress={startScan} disabled={scanning}>
              {scanning ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Scan for printers</Text>}
            </Pressable>
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <FlatList
        data={devices}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        ListHeaderComponent={devices.length > 0 ? <Text style={styles.cardTitle}>Nearby devices</Text> : null}
        renderItem={({ item }) => (
          <Pressable style={styles.deviceRow} onPress={() => handlePair(item)} disabled={pairingId === item.id}>
            <Text style={styles.deviceName}>{item.name}</Text>
            {pairingId === item.id ? <ActivityIndicator /> : <Text style={styles.pairLink}>Pair</Text>}
          </Pressable>
        )}
      />

      <Pressable style={styles.signOutRow} onPress={() => signOut()}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  title: { fontSize: 18, fontWeight: "700" },
  muted: { color: "#9ca3af", marginTop: 2 },
  card: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 14, gap: 10 },
  cardTitle: { fontSize: 11, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase" },
  deviceName: { fontWeight: "600" },
  row: { flexDirection: "row", gap: 8 },
  deviceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
  },
  pairLink: { color: "#171717", fontWeight: "600" },
  submitButton: { backgroundColor: "#171717", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  submitButtonText: { color: "#fff", fontWeight: "600" },
  secondaryButton: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, flex: 1, alignItems: "center" },
  secondaryButtonText: { color: "#374151", fontWeight: "600" },
  error: { color: "#dc2626" },
  signOutRow: { padding: 16, alignItems: "center" },
  signOutText: { color: "#dc2626", fontWeight: "600" },
});
