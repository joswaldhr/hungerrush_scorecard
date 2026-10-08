"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function SyncNowButton({ dataSourceType }: { dataSourceType: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSync() {
    setLoading(true);

    try {
      const res = await fetch("/api/sync/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataSourceType }),
      });

      if (!res.ok) {
        const body = await res.json();
        toast.error(body.error ?? "Sync failed");
        return;
      }

      toast.success(
        "Standard current-week sync completed. Separate metric refreshes are not included."
      );
      router.refresh();
    } catch {
      toast.error("Network error — could not reach the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-64 text-right">
      <Button onClick={handleSync} disabled={loading} size="sm" variant="outline">
        {loading ? "Syncing…" : "Run standard weekly sync"}
      </Button>
      <p className="mt-1 text-xs text-muted-foreground">
        Current week only. Does not run the separate solved-ticket, CSAT, first-reply, or qualified
        call refreshes.
      </p>
    </div>
  );
}
