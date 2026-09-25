"use client";

import { useEffect } from "react";
import { clientErrorReport } from "@/lib/client-error-report";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";

export default function AppError({
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
          boundary: "application",
        })
      ),
    }).catch(() => {
      // Best-effort — losing the error report shouldn't compound the failure.
    });
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 py-16">
      <ErrorState
        title="Something went wrong"
        description="An error occurred while loading this page."
      />
      <Button onClick={reset} variant="outline" size="sm">
        Try again
      </Button>
    </div>
  );
}
