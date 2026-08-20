"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";

export function AdminSignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="rounded-md border border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-300 hover:bg-gray-800"
    >
      Sign out
    </button>
  );
}
