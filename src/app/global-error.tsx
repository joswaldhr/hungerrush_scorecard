"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-4">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">An unexpected error occurred.</p>
          <button
            onClick={reset}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
