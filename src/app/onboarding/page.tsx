import { redirect } from "next/navigation";
import { getSession, getCurrentMembership } from "@/lib/auth/session";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const membership = await getCurrentMembership();
  if (membership) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Create your company</h1>
        <p className="mt-1 text-sm text-gray-500">
          You&apos;re signed in as {session.user.email}. Finish setting up your company to continue.
        </p>
      </div>

      <OnboardingForm />
    </main>
  );
}
