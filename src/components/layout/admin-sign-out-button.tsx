"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { AdminButton } from "@/components/ui-admin";

export function AdminSignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <AdminButton type="button" variant="secondary" size="sm" onClick={handleSignOut}>
      Sign out
    </AdminButton>
  );
}
