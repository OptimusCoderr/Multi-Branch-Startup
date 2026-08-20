import { redirect } from "next/navigation";
import { getSession, getCurrentMembership } from "@/lib/auth/session";
import { AuthThemeShell } from "@/components/auth/auth-theme";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const membership = await getCurrentMembership();
  if (membership) redirect("/dashboard");

  return (
    <AuthThemeShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Create your company</h1>
          <p className="mt-1 text-sm text-gray-500">
            You&apos;re signed in as {session.user.email}. Finish setting up your company to continue.
          </p>
        </div>

        <OnboardingForm />
      </div>
    </AuthThemeShell>
  );
}
