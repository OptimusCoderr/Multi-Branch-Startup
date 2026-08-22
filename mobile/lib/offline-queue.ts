import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, ApiRequestError, type CreateSaleInput } from "./api";

const STORAGE_KEY = "offline-sale-queue.v1";

export type QueueableSaleInput = Omit<CreateSaleInput, "clientRequestId">;

export type PendingSale = {
  clientRequestId: string;
  input: QueueableSaleInput;
  queuedAt: number;
  error?: string;
};

export type SyncResult = { synced: number; failed: number };

export function generateClientRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readQueue(): Promise<PendingSale[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PendingSale[];
  } catch {
    return [];
  }
}

async function writeQueue(queue: PendingSale[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export async function listPending(): Promise<PendingSale[]> {
  return readQueue();
}

/**
 * `clientRequestId` can be passed in when a caller already generated one for
 * a direct online attempt that then failed on a network error — reusing it
 * here means a later sync retry is a safe idempotent replay even if that
 * first attempt actually reached the server and the response was just lost.
 */
export async function enqueueSale(input: QueueableSaleInput, clientRequestId?: string): Promise<PendingSale> {
  const pending: PendingSale = { clientRequestId: clientRequestId ?? generateClientRequestId(), input, queuedAt: Date.now() };
  const queue = await readQueue();
  queue.push(pending);
  await writeQueue(queue);
  return pending;
}

export async function removePending(clientRequestId: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((p) => p.clientRequestId !== clientRequestId));
}

let syncing = false;

/**
 * Walks the queue in order, POSTing each with its own clientRequestId so a
 * retried sync after a dropped response reuses the original Sale instead of
 * creating a duplicate (and double-decrementing stock). A network-level
 * failure means we're still offline — stop the walk and leave everything
 * queued for next time. A validation failure from the server (stock ran out
 * while offline, the day's report was already submitted, etc.) is a real
 * rejection — it's recorded on that item and the walk continues, rather
 * than retrying a failure that will never succeed.
 */
export async function syncPending(): Promise<SyncResult> {
  if (syncing) return { synced: 0, failed: 0 };
  syncing = true;
  let synced = 0;
  let failed = 0;
  try {
    const queue = await readQueue();
    for (const pending of queue) {
      try {
        await api.createSale({ ...pending.input, clientRequestId: pending.clientRequestId });
        await removePending(pending.clientRequestId);
        synced++;
      } catch (err) {
        if (err instanceof ApiRequestError) {
          const current = await readQueue();
          await writeQueue(
            current.map((p) => (p.clientRequestId === pending.clientRequestId ? { ...p, error: err.message } : p)),
          );
          failed++;
        } else {
          break;
        }
      }
    }
  } finally {
    syncing = false;
  }
  return { synced, failed };
}
