"use client";

import { useActionState, useTransition } from "react";
import {
  approveCompanyVerification,
  rejectCompanyVerification,
  approveCompanyWithoutCac,
} from "@/server/actions/company-oversight";

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
      <button
        type="button"
        disabled={isApproving}
        onClick={() => startApprove(async () => { await approveCompanyVerification(companyId); })}
        className="w-fit rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isApproving ? "Approving…" : "Approve & verify"}
      </button>

      <form action={rejectFormAction} className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm text-gray-400">
          Rejection reason
          <textarea
            name="reason"
            required
            rows={2}
            className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
          />
        </label>
        {rejectState.error && <p className="text-sm text-red-400">{rejectState.error}</p>}
        <button
          type="submit"
          disabled={isRejecting}
          className="w-fit rounded-md border border-red-500/50 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
        >
          {isRejecting ? "Rejecting…" : "Reject"}
        </button>
      </form>

      <form action={withoutCacFormAction} className="flex flex-col gap-2 border-t border-gray-800 pt-4">
        <label className="flex flex-col gap-1 text-sm text-gray-400">
          Approve without a CAC certificate <span className="text-gray-500">(optional note)</span>
          <textarea
            name="note"
            rows={2}
            placeholder="e.g. not yet incorporated, verified by phone"
            className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
          />
        </label>
        {withoutCacState.error && <p className="text-sm text-red-400">{withoutCacState.error}</p>}
        <button
          type="submit"
          disabled={isApprovingWithoutCac}
          className="w-fit rounded-md border border-blue-500/50 px-4 py-2 text-sm font-medium text-blue-300 hover:bg-blue-500/10 disabled:opacity-50"
        >
          {isApprovingWithoutCac ? "Approving…" : "Approve without CAC"}
        </button>
      </form>
    </div>
  );
}
