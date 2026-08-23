import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Network from "expo-network";
import { syncPending, type SyncResult } from "./offline-queue";

function isReachable(state: Network.NetworkState): boolean {
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

export async function isOnline(): Promise<boolean> {
  return isReachable(await Network.getNetworkStateAsync());
}

/** Live connectivity flag, updated as the device's network state changes. */
export function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let mounted = true;
    Network.getNetworkStateAsync().then((state) => {
      if (mounted) setOnline(isReachable(state));
    });
    const subscription = Network.addNetworkStateListener((state) => setOnline(isReachable(state)));
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return online;
}

/**
 * Fires syncPending() whenever the device regains connectivity or the app
 * returns to the foreground — the two moments a queued offline sale is
 * actually able to reach the server. Network state listeners can be missed
 * or debounced by the OS, so the app-foreground check is a deliberate
 * backstop, not a duplicate of the same signal.
 */
export function useAutoSyncOfflineQueue(onResult?: (result: SyncResult) => void): void {
  const online = useIsOnline();
  const wasOffline = useRef(!online);
  const callback = useRef(onResult);
  callback.current = onResult;

  const runSync = useCallback(() => {
    syncPending().then((result) => {
      if (result.synced > 0 || result.failed > 0) callback.current?.(result);
    });
  }, []);

  useEffect(() => {
    if (online && wasOffline.current) runSync();
    wasOffline.current = !online;
  }, [online, runSync]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") runSync();
    });
    return () => subscription.remove();
  }, [runSync]);
}
