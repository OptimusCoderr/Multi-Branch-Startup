import "server-only";
import type { getScopedPrisma } from "@/lib/db/scoped-prisma";

type ScopedTx = Pick<ReturnType<typeof getScopedPrisma>, "waybill">;

/**
 * Sequential per company (WB-2026-000001), not a real Postgres sequence —
 * same retry-on-collision approach as generateProductSku(), since a
 * per-tenant Postgres sequence would mean creating one per company.
 */
async function generateWaybillReference(tx: ScopedTx, companyId: string): Promise<string> {
  const prefix = `WB-${new Date().getFullYear()}-`;
  const count = await tx.waybill.count({ where: { companyId, reference: { startsWith: prefix } } });

  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = `${prefix}${String(count + 1 + attempt).padStart(6, "0")}`;
    const taken = await tx.waybill.findFirst({ where: { companyId, reference: candidate } });
    if (!taken) return candidate;
  }
  throw new Error("Could not generate a unique waybill reference — please try again.");
}

/**
 * Called from dispatchTransfer() the moment a warehouse-sourced transfer's
 * stock actually leaves the warehouse — this is the "seal" moment. Never
 * called for a branch- or external-sourced transfer; those keep the
 * existing forgiving accept-and-notify receiving behavior.
 */
export async function createWaybillForTransfer(tx: ScopedTx, companyId: string, stockTransferId: string) {
  const reference = await generateWaybillReference(tx, companyId);
  return tx.waybill.create({ data: { companyId, stockTransferId, reference } });
}

export type WaybillGuardResult =
  | { outcome: "no_waybill" }
  | { outcome: "matched" }
  | { outcome: "mismatch"; attemptsRemaining: number }
  | { outcome: "locked_now" }
  | { outcome: "already_locked" };

/**
 * Checks a declared receive quantity against a warehouse-sourced
 * transfer's waybill and records the outcome — MATCHED, another
 * mismatch, or LOCKED on the second mismatch. Deliberately never throws:
 * every outcome here is a real, permanent write (an attempt happened, it
 * has to be on the record even when the receive itself must not proceed)
 * and a single Prisma transaction can't partially commit, so this always
 * runs — and its write always survives — in its own transaction, called
 * from the action layer BEFORE it ever decides whether to call
 * transferService.receiveTransfer at all. No waybill (branch/external
 * source) resolves as "no_waybill" — the caller proceeds exactly as
 * before this feature existed.
 */
export async function guardWaybillReceive(
  tx: ScopedTx,
  stockTransferId: string,
  declaredQuantity: number,
  expectedQuantity: number,
): Promise<WaybillGuardResult> {
  const waybill = await tx.waybill.findUnique({ where: { stockTransferId } });
  if (!waybill) return { outcome: "no_waybill" };
  if (waybill.status === "LOCKED") return { outcome: "already_locked" };

  if (declaredQuantity === expectedQuantity) {
    await tx.waybill.update({ where: { id: waybill.id }, data: { status: "MATCHED" } });
    return { outcome: "matched" };
  }

  const attempts = waybill.mismatchAttempts + 1;
  if (attempts >= 2) {
    await tx.waybill.update({
      where: { id: waybill.id },
      data: { mismatchAttempts: attempts, lastDeclaredQuantity: declaredQuantity, status: "LOCKED", lockedAt: new Date() },
    });
    return { outcome: "locked_now" };
  }

  await tx.waybill.update({ where: { id: waybill.id }, data: { mismatchAttempts: attempts, lastDeclaredQuantity: declaredQuantity } });
  return { outcome: "mismatch", attemptsRemaining: 2 - attempts };
}
