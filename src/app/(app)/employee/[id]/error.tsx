"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function EmployeeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        stack: error.stack,
        url: window.location.href,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <Link href="/team" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to team
        </Link>
      </div>
      <div className="flex flex-col items-center gap-4 py-16">
        <ErrorState
          title="Couldn't load employee data"
          description="There was a problem loading this employee's information."
        />
        <Button onClick={reset} variant="outline" size="sm">
          Try again
        </Button>
      </div>
    </div>
  );
}
