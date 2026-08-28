"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in with Microsoft"}
    </Button>
  );
}

export function SSOButton({ action }: { action: () => Promise<void> }) {
  return (
    <form action={action}>
      <SubmitButton />
    </form>
  );
}
