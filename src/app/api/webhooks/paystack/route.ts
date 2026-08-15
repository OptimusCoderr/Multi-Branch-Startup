import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { verifyPaystackSignature } from "@/lib/paystack/verify-signature";
import { applyWebhookEvent } from "@/server/services/billing-service";

/**
 * Paystack webhook receiver. A plain Route Handler (not a Server Action) —
 * it's called by Paystack's servers, not a browser, so it must be a
 * regular HTTP endpoint with no session/CSRF expectations. Every request
 * must carry a valid x-paystack-signature or it's rejected outright; the
 * payload is never trusted otherwise.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  const secretKey = process.env.PAYSTACK_SECRET_KEY ?? "";

  if (!verifyPaystackSignature(rawBody, signature, secretKey)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: { event?: string; data?: Record<string, unknown> };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Paystack doesn't guarantee a stable unique event id in the payload
  // itself, but retried deliveries resend the exact same bytes — hashing
  // the raw body is a reliable idempotency key for "have we already
  // processed this exact delivery."
  const paystackEventId = createHash("sha256").update(rawBody).digest("hex");

  const existing = await prisma.paystackEvent.findUnique({ where: { paystackEventId } });
  if (existing?.status === "PROCESSED") {
    return NextResponse.json({ status: "already processed" });
  }

  const eventRecord =
    existing ??
    (await prisma.paystackEvent.create({
      data: { paystackEventId, eventType: payload.event ?? "unknown", payload: payload as object, status: "RECEIVED" },
    }));

  try {
    await applyWebhookEvent(payload.event ?? "", payload.data ?? {});
    await prisma.paystackEvent.update({
      where: { id: eventRecord.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
  } catch (err) {
    // Recorded for operator visibility rather than triggering endless
    // Paystack retries — a data-shape problem (e.g. missing companyId in
    // metadata) won't be fixed by resending the same payload.
    await prisma.paystackEvent.update({
      where: { id: eventRecord.id },
      data: { status: "FAILED", error: err instanceof Error ? err.message : "Unknown error" },
    });
  }

  return NextResponse.json({ status: "ok" });
}
