import { signIn } from "@/lib/auth";
import { env } from "@/lib/env";
import { LoginForm } from "./login-form";
import { SSOButton } from "./sso-button";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const entraConfigured = Boolean(
    env.AUTH_MICROSOFT_ENTRA_ID_ID && env.AUTH_MICROSOFT_ENTRA_ID_SECRET
  );
  const showDevLogin = process.env.NODE_ENV !== "production";

  async function handleSSO() {
    "use server";
    await signIn("microsoft-entra-id", { redirectTo: "/" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm overflow-hidden shadow-sm border-border/80">
        <CardContent className="p-8 space-y-6">
          <div className="space-y-3 text-center">
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hungerrush-logo.png"
                alt="HungerRush"
                className="h-8 w-auto dark:hidden"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hungerrush-logo-reversed.png"
                alt="HungerRush"
                className="hidden h-8 w-auto dark:block"
              />
            </div>
            <h1 className="text-lg font-semibold tracking-wide text-[#108574] uppercase">
              Cadence
            </h1>
            <p className="text-xs text-muted-foreground">
              {entraConfigured
                ? "Sign in with your HungerRush account"
                : "Select a test profile to continue"}
            </p>
          </div>

          {entraConfigured && <SSOButton action={handleSSO} />}

          {showDevLogin && (
            <div className="space-y-3">
              {entraConfigured && (
                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/80" />
                  </div>
                  <span className="relative bg-card px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Or development profiles
                  </span>
                </div>
              )}
              <LoginForm />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
