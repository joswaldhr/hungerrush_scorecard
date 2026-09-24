"use client";

import { useEffect } from "react";
import { clientErrorReport } from "@/lib/client-error-report";

export const dynamic = "force-dynamic";

export default function GlobalError({
  error,
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
          boundary: "global",
        })
      ),
    }).catch(() => {
      // Best-effort — losing the error report shouldn't compound the failure.
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-4">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">An unexpected error occurred.</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
