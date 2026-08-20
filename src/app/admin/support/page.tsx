import { PasswordResetTool } from "@/components/forms/password-reset-tool";

export default function AdminSupportPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Support</h1>
        <p className="mt-1 text-sm text-gray-400">
          Help a locked-out user reset their password. Verify who you&apos;re talking to before sharing the link —
          it grants access to their account.
        </p>
      </div>

      <PasswordResetTool />
    </div>
  );
}
