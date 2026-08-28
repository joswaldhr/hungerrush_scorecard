"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";

export default function TeamError({
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
      <div className="flex flex-col items-center gap-4 py-16">
        <ErrorState
          title="Couldn't load team data"
          description="There was a problem loading the team roster. This may be a temporary issue."
        />
        <Button onClick={reset} variant="outline" size="sm">
          Try again
        </Button>
      </div>
    </div>
  );
}
