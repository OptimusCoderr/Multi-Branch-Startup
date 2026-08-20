"use client";

import { useTransition } from "react";
import { demotePlatformStaff } from "@/server/actions/platform-admin";

export function DemoteStaffButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await demotePlatformStaff(userId);
        })
      }
      className="text-sm text-red-400 hover:underline disabled:opacity-50"
    >
      {isPending ? "Removing…" : "Remove access"}
    </button>
  );
}
