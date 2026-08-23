"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";

/** Shows the company's join code so an Owner can hand it to new hires for self-service staff sign-up. */
export function CompanyCodeCard({ companyCode }: { companyCode: string }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    await navigator.clipboard.writeText(companyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="flex flex-col gap-1">
      <p className="text-gray-500 dark:text-gray-400 text-sm">
        Share this code with new staff — they enter it at sign-up to request to join your company. You&apos;ll still need
        to approve each request and assign a role before they get access.
      </p>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-gray-50 dark:bg-gray-900 px-2 py-1 text-sm font-semibold tracking-wide">
          {companyCode}
        </code>
        <Button type="button" variant="link" onClick={copyCode}>
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
    </Card>
  );
}
