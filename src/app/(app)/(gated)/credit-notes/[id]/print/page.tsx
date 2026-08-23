import { notFound } from "next/navigation";
import Image from "next/image";
import { requireMembership } from "@/lib/auth/session";
import { getScopedPrisma } from "@/lib/db/scoped-prisma";
import { formatMoney } from "@/lib/format";
import { getBrandingSettings } from "@/lib/branding";
import { resolveMembershipNames } from "@/lib/auth/membership-names";
import { PrintButton } from "@/components/print-button";

export default async function CreditNotePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireMembership();
  const db = getScopedPrisma(membership.companyId);
  const currency = membership.companyCurrency;

  const [creditNote, branding] = await Promise.all([
    db.creditNote.findUnique({
      where: { id },
      include: { sale: { include: { branch: true } } },
    }),
    getBrandingSettings(membership.companyId),
  ]);
  if (!creditNote) notFound();

  const names = await resolveMembershipNames(db, [creditNote.issuedByMembershipId]);
  const issuedBy = names.get(creditNote.issuedByMembershipId) ?? "Unknown";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6 print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold">Credit note preview</h1>
        <PrintButton />
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-8 print:border-0 print:p-0">
        <div className="flex items-start justify-between border-b border-gray-200 dark:border-gray-800 pb-4">
          <div className="flex items-center gap-2">
            {branding.logoUrl && (
              <Image src={branding.logoUrl} alt="" width={32} height={32} unoptimized className="rounded" />
            )}
            <p className="text-lg font-semibold">{membership.companyName}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">CREDIT NOTE</p>
            <p className="font-mono text-sm text-gray-500 dark:text-gray-400">{creditNote.creditNoteNumber}</p>
          </div>
        </div>

        <div className="mt-4 flex justify-between text-sm">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">Against invoice</p>
            <p className="font-mono">{creditNote.sale.saleNumber}</p>
            <p className="text-gray-500 dark:text-gray-400">{creditNote.sale.customerName ?? "Walk-in customer"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">Details</p>
            <p>{creditNote.sale.branch.name}</p>
            <p className="text-gray-500 dark:text-gray-400">{creditNote.createdAt.toLocaleDateString()}</p>
            <p className="text-gray-500 dark:text-gray-400">Issued by {issuedBy}</p>
          </div>
        </div>

        <div className="mt-6 rounded-md bg-gray-50 dark:bg-gray-900 p-4 text-sm">
          <p className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">Reason</p>
          <p className="mt-1">{creditNote.reason}</p>
        </div>

        <p className="mt-6 text-right text-lg font-semibold">
          Credit amount: {formatMoney(creditNote.amount.toString(), currency)}
        </p>

        {creditNote.status === "VOIDED" && (
          <p className="mt-6 border-t border-gray-200 dark:border-gray-800 pt-4 text-center text-sm font-semibold text-red-600 dark:text-red-400">
            THIS CREDIT NOTE HAS BEEN VOIDED — {creditNote.voidReason}
          </p>
        )}
      </div>
    </div>
  );
}
