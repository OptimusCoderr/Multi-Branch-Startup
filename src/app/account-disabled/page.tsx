import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function AccountDisabledPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
    include: { company: true },
  });

  // If access was restored since this was last checked, don't leave people stuck.
  if (!membership || membership.company.status !== "SUSPENDED") redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Account disabled</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {membership.company.name}&apos;s account has been disabled by a platform administrator
        {membership.company.disabledReason ? `: ${membership.company.disabledReason}` : "."}
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400">Contact support if you believe this is a mistake.</p>
    </main>
  );
}
