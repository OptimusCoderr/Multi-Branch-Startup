import { useEffect, useRef } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { theme } from "@/lib/theme";

// EAN-13/EAN-8/UPC-A/UPC-E cover virtually every retail product barcode;
// code128 and QR are included for internally-generated labels (a company
// printing its own barcodes/QR codes for products without a manufacturer one).
const BARCODE_TYPES = ["ean13", "ean8", "upc_a", "upc_e", "code128", "qr"] as const;

export function BarcodeScannerModal({
  visible,
  onScanned,
  onClose,
  title = "Scan a barcode",
}: {
  visible: boolean;
  onScanned: (data: string) => void;
  onClose: () => void;
  title?: string;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  // A physical barcode sits in frame for many camera frames in a row —
  // without this, onBarcodeScanned fires repeatedly for the same code
  // before the caller has a chance to close the modal or navigate away.
  const hasScannedRef = useRef(false);

  useEffect(() => {
    if (visible) hasScannedRef.current = false;
  }, [visible]);

  function handleScanned(result: BarcodeScanningResult) {
    if (hasScannedRef.current) return;
    hasScannedRef.current = true;
    onScanned(result.data);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {!permission ? (
          <View style={styles.center}>
            <Text style={styles.message}>Checking camera access…</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.message}>
              {permission.canAskAgain
                ? "Camera access is needed to scan barcodes."
                : "Camera access was denied. Enable it in system settings to scan barcodes."}
            </Text>
            {permission.canAskAgain && (
              <Pressable style={styles.primaryButton} onPress={requestPermission}>
                <Text style={styles.primaryButtonText}>Grant camera access</Text>
              </Pressable>
            )}
            <Pressable style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
              onBarcodeScanned={handleScanned}
            />
            <View style={styles.overlay} pointerEvents="box-none">
              <Text style={styles.title}>{title}</Text>
              <View style={styles.viewfinder} />
              <Text style={styles.hint}>Point your camera at a barcode</Text>
              <Pressable style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  message: { color: "#fff", textAlign: "center", fontSize: 15 },
  primaryButton: { backgroundColor: theme.primary, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20 },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
  secondaryButton: { paddingVertical: 10, paddingHorizontal: 20 },
  secondaryButtonText: { color: "#d1d5db" },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingBottom: 40,
  },
  title: { color: "#fff", fontSize: 16, fontWeight: "600", position: "absolute", top: 60 },
  viewfinder: {
    width: 260,
    height: 160,
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  hint: { color: "#e5e7eb", fontSize: 13 },
  closeButton: {
    position: "absolute",
    bottom: 40,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  closeButtonText: { color: "#fff", fontWeight: "600" },
});
