"use client";

import { useActionState, useTransition } from "react";
import {
  approveCompanyVerification,
  rejectCompanyVerification,
  approveCompanyWithoutCac,
} from "@/server/actions/company-oversight";
import { AdminField, AdminTextarea, AdminFormError, AdminButton } from "@/components/ui-admin";

type FormState = { error: string };
const initialState: FormState = { error: "" };

/** SUPER_ADMIN-only review actions for one company's pending/rejected CAC submission. */
export function CompanyVerificationReview({ companyId }: { companyId: string }) {
  const [isApproving, startApprove] = useTransition();
  const [rejectState, rejectFormAction, isRejecting] = useActionState(rejectCompanyVerification.bind(null, companyId), initialState);
  const [withoutCacState, withoutCacFormAction, isApprovingWithoutCac] = useActionState(
    approveCompanyWithoutCac.bind(null, companyId),
    initialState,
  );

  return (
    <div className="flex flex-col gap-4">
      <AdminButton
        type="button"
        variant="primary"
        className="w-fit bg-green-600 hover:bg-green-500 focus-visible:ring-green-400"
        isPending={isApproving}
        pendingLabel="Approving…"
        onClick={() => startApprove(async () => { await approveCompanyVerification(companyId); })}
      >
        Approve & verify
      </AdminButton>

      <form action={rejectFormAction} className="flex flex-col gap-2">
        <AdminField label="Rejection reason">
          <AdminTextarea name="reason" required rows={2} />
        </AdminField>
        <AdminFormError error={rejectState.error} />
        <AdminButton
          type="submit"
          variant="secondary"
          className="w-fit border-red-500/50 text-red-400 hover:bg-red-500/10"
          isPending={isRejecting}
          pendingLabel="Rejecting…"
        >
          Reject
        </AdminButton>
      </form>

      <form action={withoutCacFormAction} className="flex flex-col gap-2 border-t border-gray-800 pt-4">
        <AdminField label="Approve without a CAC certificate (optional note)">
          <AdminTextarea name="note" rows={2} placeholder="e.g. not yet incorporated, verified by phone" />
        </AdminField>
        <AdminFormError error={withoutCacState.error} />
        <AdminButton
          type="submit"
          variant="secondary"
          className="w-fit border-blue-500/50 text-blue-300 hover:bg-blue-500/10"
          isPending={isApprovingWithoutCac}
          pendingLabel="Approving…"
        >
          Approve without CAC
        </AdminButton>
      </form>
    </div>
  );
}
