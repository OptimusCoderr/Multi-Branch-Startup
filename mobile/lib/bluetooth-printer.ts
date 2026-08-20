import { Platform, PermissionsAndroid } from "react-native";
import { BleManager, type Device, type Characteristic } from "react-native-ble-plx";
import * as SecureStore from "expo-secure-store";
import base64js from "base64-js";

/**
 * Talks to a paired Bluetooth Low Energy (BLE) thermal receipt printer.
 *
 * BLE, not classic Bluetooth SPP: iOS never exposes classic SPP sockets to
 * third-party apps (only MFi-certified accessories get that), so a printer
 * driver that has to work on both iOS and Android has to speak BLE GATT —
 * which is also what the vast majority of cheap 58mm/80mm receipt printers
 * sold today actually implement. There is no single standard "printer
 * service" UUID across vendors, so pairing here is: scan → user picks their
 * printer from a list of nearby BLE devices → connect → discover every
 * service/characteristic → pick the first one that's writable. That matches
 * how these printers are actually driven in practice (see e.g. how
 * PrinterCharacteristic-style libraries for POS printers do it) and avoids
 * hard-coding a vendor's UUID that would just be wrong for a different
 * printer model.
 *
 * NOTE: this module cannot be exercised against real hardware in this
 * environment (no Bluetooth radio / physical printer available here). It's
 * written to the documented react-native-ble-plx API and standard ESC/POS
 * BLE-printer conventions, but genuine pairing/printing needs to be
 * verified on a real device with a real printer.
 */

const SAVED_PRINTER_KEY = "bluetooth-printer";
const MTU_SAFE_CHUNK_SIZE = 180; // conservative; negotiated MTU is usually >=185 bytes usable, but many cheap printers stall on larger writes
const CHUNK_DELAY_MS = 20; // small delay between writes so a slow printer MCU's buffer doesn't overflow

export type SavedPrinter = {
  deviceId: string;
  deviceName: string;
  serviceUUID: string;
  characteristicUUID: string;
  writeWithResponse: boolean;
};

export type ScannedDevice = { id: string; name: string; rssi: number | null };

let manager: BleManager | null = null;

function getManager(): BleManager {
  if (!manager) manager = new BleManager();
  return manager;
}

export class BluetoothPrinterError extends Error {}

/**
 * Requests the runtime permissions BLE scanning/connecting needs. iOS asks
 * automatically (driven by the NSBluetoothAlwaysUsageDescription in
 * app.json) the first time the manager is used, so this is a no-op there.
 * Android needs explicit runtime grants, and which ones depends on the API
 * level: 31+ (Android 12+) uses BLUETOOTH_SCAN/BLUETOOTH_CONNECT (declared
 * with neverForLocation in app.json, so no location permission is needed);
 * below that, BLE scanning is classified as a location API and needs
 * ACCESS_FINE_LOCATION.
 */
export async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;

  if (Platform.Version >= 31) {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return Object.values(results).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
  }

  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * Scans for nearby BLE devices for `durationMs`, calling `onDevice` as each
 * new device is seen (deduped by id). Returns a stop function the caller
 * can invoke early (e.g. when the user closes the pairing screen).
 */
export function scanForPrinters(onDevice: (device: ScannedDevice) => void, durationMs = 8000): () => void {
  const ble = getManager();
  const seen = new Set<string>();

  ble.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
    if (error) {
      throw new BluetoothPrinterError(error.message);
    }
    if (!device || seen.has(device.id)) return;
    seen.add(device.id);
    onDevice({ id: device.id, name: device.name ?? device.localName ?? "Unknown device", rssi: device.rssi });
  });

  const timeout = setTimeout(() => ble.stopDeviceScan(), durationMs);
  return () => {
    clearTimeout(timeout);
    ble.stopDeviceScan();
  };
}

/** Finds the first writable characteristic across all of a device's services — see module doc for why. */
async function findWritableCharacteristic(device: Device): Promise<Characteristic> {
  await device.discoverAllServicesAndCharacteristics();
  const services = await device.services();

  for (const service of services) {
    const characteristics = await device.characteristicsForService(service.uuid);
    const writable = characteristics.find((c) => c.isWritableWithResponse || c.isWritableWithoutResponse);
    if (writable) return writable;
  }

  throw new BluetoothPrinterError("This device has no writable Bluetooth characteristic — it doesn't look like a printer.");
}

/** Connects to a scanned device, locates its printer characteristic, and saves it as the default printer for future prints. */
export async function pairPrinter(deviceId: string, deviceName: string): Promise<SavedPrinter> {
  const ble = getManager();
  const device = await ble.connectToDevice(deviceId, { timeout: 10000 });
  const characteristic = await findWritableCharacteristic(device);

  const saved: SavedPrinter = {
    deviceId,
    deviceName,
    serviceUUID: characteristic.serviceUUID,
    characteristicUUID: characteristic.uuid,
    writeWithResponse: characteristic.isWritableWithResponse,
  };
  await SecureStore.setItemAsync(SAVED_PRINTER_KEY, JSON.stringify(saved));
  await ble.cancelDeviceConnection(deviceId).catch(() => {});
  return saved;
}

export async function getSavedPrinter(): Promise<SavedPrinter | null> {
  const raw = await SecureStore.getItemAsync(SAVED_PRINTER_KEY);
  return raw ? (JSON.parse(raw) as SavedPrinter) : null;
}

export async function clearSavedPrinter(): Promise<void> {
  await SecureStore.deleteItemAsync(SAVED_PRINTER_KEY);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Connects to the saved printer, writes the given ESC/POS bytes in
 * MTU-safe chunks, then disconnects. Each print job opens and closes its
 * own connection rather than holding one open — thermal printers are
 * printed to occasionally (per receipt), not streamed to continuously, and
 * a short-lived connection is far less likely to be left dangling if the
 * app is backgrounded mid-print.
 */
export async function printBytes(bytes: Uint8Array): Promise<void> {
  const saved = await getSavedPrinter();
  if (!saved) throw new BluetoothPrinterError("No printer paired yet. Pair a printer in Settings first.");

  const ble = getManager();
  await ble.connectToDevice(saved.deviceId, { timeout: 10000 });
  await ble.discoverAllServicesAndCharacteristicsForDevice(saved.deviceId);

  try {
    for (let offset = 0; offset < bytes.length; offset += MTU_SAFE_CHUNK_SIZE) {
      const chunk = bytes.slice(offset, offset + MTU_SAFE_CHUNK_SIZE);
      const base64Chunk = base64js.fromByteArray(chunk);
      if (saved.writeWithResponse) {
        await ble.writeCharacteristicWithResponseForDevice(saved.deviceId, saved.serviceUUID, saved.characteristicUUID, base64Chunk);
      } else {
        await ble.writeCharacteristicWithoutResponseForDevice(saved.deviceId, saved.serviceUUID, saved.characteristicUUID, base64Chunk);
      }
      if (offset + MTU_SAFE_CHUNK_SIZE < bytes.length) await sleep(CHUNK_DELAY_MS);
    }
  } finally {
    await ble.cancelDeviceConnection(saved.deviceId).catch(() => {});
  }
}
