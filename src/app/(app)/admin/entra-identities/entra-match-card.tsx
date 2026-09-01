"use client";

import { useState } from "react";
import { searchEntraCandidates, confirmEntraMatch, markNoEntraMatch } from "./actions";
import type { EntraCandidate } from "@/lib/connectors/entra";
import { toast } from "sonner";

export function EntraMatchCard({
  employeeId,
  displayName,
}: {
  employeeId: string;
  displayName: string;
}) {
  const [query, setQuery] = useState(displayName);
  const [candidates, setCandidates] = useState<EntraCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);

  async function handleSearch() {
    setSearching(true);
    try {
      const results = await searchEntraCandidates(query);
      setCandidates(results);
      if (results.length === 0) toast.info("No Entra accounts found for that name");
    } catch {
      toast.error("Entra search failed");
    } finally {
      setSearching(false);
    }
  }

  async function handleConfirm(formData: FormData) {
    try {
      await confirmEntraMatch(formData);
      toast.success("Identity matched");
    } catch {
      toast.error("Failed to save match");
    }
  }

  async function handleNoMatch(formData: FormData) {
    try {
      await markNoEntraMatch(formData);
      toast.success("Marked as no Entra account");
    } catch {
      toast.error("Failed to save");
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{displayName}</p>
        <form action={handleNoMatch}>
          <input type="hidden" name="employeeId" value={employeeId} />
          <button type="submit" className="text-xs text-muted-foreground hover:text-foreground">
            No Entra account
          </button>
        </form>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        />
        <button
          onClick={handleSearch}
          disabled={searching}
          className="rounded-md border border-accent px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
        >
          {searching ? "Searching…" : "Search Entra"}
        </button>
      </div>

      {candidates && candidates.length > 0 && (
        <ul className="space-y-1.5">
          {candidates.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-xs"
            >
              <div>
                <p className="font-medium text-foreground">{c.displayName}</p>
                <p className="text-muted-foreground">
                  {c.userPrincipalName} {!c.accountEnabled && "· disabled"}
                </p>
              </div>
              <form action={handleConfirm}>
                <input type="hidden" name="employeeId" value={employeeId} />
                <input type="hidden" name="objectId" value={c.id} />
                <input type="hidden" name="displayName" value={c.displayName} />
                <input type="hidden" name="mail" value={c.mail ?? ""} />
                <input type="hidden" name="userPrincipalName" value={c.userPrincipalName} />
                <button
                  type="submit"
                  className="rounded-md bg-accent px-2.5 py-1 font-medium text-accent-foreground hover:bg-accent/90"
                >
                  This is them
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
