"use client";

import { useTransition } from "react";
import { demotePlatformStaff } from "@/server/actions/platform-admin";
import { AdminButton } from "@/components/ui-admin";

export function DemoteStaffButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <AdminButton
      type="button"
      variant="danger-link"
      isPending={isPending}
      pendingLabel="Removing…"
      onClick={() =>
        startTransition(async () => {
          await demotePlatformStaff(userId);
        })
      }
    >
      Remove access
    </AdminButton>
  );
}
