import { redirect } from "next/navigation";
import { getSession, getCurrentMembership } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { SignOutButton } from "@/components/layout/sign-out-button";

export default async function PendingApprovalPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  // If access was granted (or the account otherwise became active) since this was last checked, don't leave people stuck here.
  const membership = await getCurrentMembership();
  if (membership) redirect("/dashboard");

  const pendingMembership = await prisma.membership.findFirst({
    where: { userId: session.user.id, status: "PENDING" },
    include: { company: { select: { name: true } } },
  });

  // No pending request on record (never requested, or it was rejected) — send them back to start over.
  if (!pendingMembership) redirect("/onboarding");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Request sent</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Your request to join <strong>{pendingMembership.company.name}</strong> is waiting for an Owner to approve it
        and assign you a role.
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        You&apos;ll be able to sign in as soon as that happens — check back soon, or ask your employer to review it
        from their Staff page.
      </p>
      <div className="flex justify-center">
        <SignOutButton />
      </div>
    </main>
  );
}
