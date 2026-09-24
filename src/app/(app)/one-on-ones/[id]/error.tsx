"use client";

import { useEffect } from "react";
import { clientErrorReport } from "@/lib/client-error-report";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function OneOnOneError({
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
      body: JSON.stringify(
        clientErrorReport({
          digest: error.digest,
          url: window.location.pathname,
          boundary: "scorecard",
        })
      ),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <Link href="/one-on-ones" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to 1:1s
        </Link>
      </div>
      <div className="flex flex-col items-center gap-4 py-16">
        <ErrorState
          title="Couldn't load 1:1 data"
          description="There was a problem loading this employee's scorecard."
        />
        <Button onClick={reset} variant="outline" size="sm">
          Try again
        </Button>
      </div>
    </div>
  );
}
