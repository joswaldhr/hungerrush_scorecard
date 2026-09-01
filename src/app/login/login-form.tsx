"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEV_USERS } from "@/lib/auth/dev-users";
import { initials } from "@/lib/utils";
import { toast } from "sonner";

export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(email: string) {
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        callbackUrl: "/",
        redirect: false,
      });
      if (result?.error) {
        toast.error("Sign-in failed. Please try again.");
        setIsLoading(false);
      } else if (result?.url) {
        router.push(result.url);
      }
    } catch {
      toast.error("Sign-in failed. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {DEV_USERS.map((user) => (
        <button
          key={user.id}
          onClick={() => handleLogin(user.email)}
          disabled={isLoading}
          className="flex w-full items-center gap-3 rounded-md border border-border bg-card px-4 py-3 text-left text-sm transition-colors hover:bg-secondary disabled:opacity-50"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            {initials(user.name)}
          </div>
          <div>
            <div className="font-medium text-foreground">{user.name}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
