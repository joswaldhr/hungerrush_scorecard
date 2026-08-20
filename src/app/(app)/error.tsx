"use client";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
