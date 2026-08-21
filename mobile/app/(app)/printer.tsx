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
import { theme } from "@/lib/theme";
import { Button, Card, ListItem } from "@/components/ui";

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
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <View>
          <Text style={styles.title}>Receipt printer</Text>
          <Text style={styles.muted}>Pair a Bluetooth thermal receipt printer to print invoices and credit notes.</Text>
        </View>

        {savedPrinter === undefined ? (
          <ActivityIndicator />
        ) : savedPrinter ? (
          <Card>
            <Text style={styles.cardTitle}>Paired printer</Text>
            <Text style={styles.deviceName}>{savedPrinter.deviceName}</Text>
            <View style={styles.row}>
              <Button label="Test print" variant="secondary" size="sm" onPress={handleTestPrint} isLoading={testing} style={{ flex: 1 }} />
              <Button label="Forget" variant="secondary" size="sm" onPress={handleForget} style={{ flex: 1 }} />
            </View>
          </Card>
        ) : (
          <Card>
            <Text style={styles.cardTitle}>No printer paired</Text>
            <Button label="Scan for printers" onPress={startScan} isLoading={scanning} />
          </Card>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <FlatList
        data={devices}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm }}
        ListHeaderComponent={devices.length > 0 ? <Text style={styles.cardTitle}>Nearby devices</Text> : null}
        renderItem={({ item }) => (
          <ListItem
            title={item.name}
            trailing={pairingId === item.id ? <ActivityIndicator /> : <Text style={styles.pairLink}>Pair</Text>}
            onPress={() => handlePair(item)}
          />
        )}
      />

      <Pressable style={styles.signOutRow} onPress={() => signOut()}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.surface },
  title: { fontSize: theme.font.h1, fontWeight: "700", color: theme.textPrimary },
  muted: { color: theme.textFaint, marginTop: 2 },
  cardTitle: { fontSize: theme.font.micro, fontWeight: "600", color: theme.textFaint, textTransform: "uppercase" },
  deviceName: { fontWeight: "600", color: theme.textPrimary },
  row: { flexDirection: "row", gap: theme.spacing.sm },
  pairLink: { color: theme.primary, fontWeight: "600" },
  error: { color: theme.danger },
  signOutRow: { padding: theme.spacing.lg, alignItems: "center" },
  signOutText: { color: theme.danger, fontWeight: "600" },
});
