import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { hashInvitationToken } from "@/lib/auth/invitation-token";
import { getSession, getCurrentMembership } from "@/lib/auth/session";
import { InviteAuthForm } from "./invite-auth-form";
import { AcceptInvitationButton } from "./accept-invitation-button";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenHash = hashInvitationToken(token);

  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
    include: { company: true, role: true },
  });

  if (!invitation) {
    return <InviteMessage title="Invitation not found" body="This invite link is invalid." />;
  }
  if (invitation.status === "ACCEPTED") {
    return <InviteMessage title="Already accepted" body="This invitation has already been used." />;
  }
  if (invitation.status === "REVOKED") {
    return <InviteMessage title="Invitation revoked" body="This invitation is no longer valid." />;
  }
  if (invitation.expiresAt < new Date()) {
    return <InviteMessage title="Invitation expired" body="Ask the company to send you a new invite." />;
  }

  const session = await getSession();
  const existingMembership = session ? await getCurrentMembership() : null;
  if (existingMembership) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Join {invitation.company.name}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          You&apos;ve been invited as <span className="font-medium">{invitation.role.name}</span>.
        </p>
      </div>

      {session ? (
        session.user.email.toLowerCase() === invitation.email.toLowerCase() ? (
          <AcceptInvitationButton token={token} email={session.user.email} />
        ) : (
          <InviteMessage
            title="Signed in as a different email"
            body={`This invitation was sent to ${invitation.email}, but you're signed in as ${session.user.email}. Sign out and try again.`}
          />
        )
      ) : (
        <InviteAuthForm token={token} invitedEmail={invitation.email} />
      )}
    </main>
  );
}

function InviteMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">{body}</p>
    </main>
  );
}
