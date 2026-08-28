"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SyncNowButton({ dataSourceType }: { dataSourceType: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/sync/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataSourceType }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Sync failed");
        return;
      }

      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleSync} disabled={loading} size="sm" variant="outline">
        {loading ? "Syncing..." : "Sync now"}
      </Button>
      {error && <p className="text-xs text-status-attention">{error}</p>}
    </div>
  );
}
