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
            {/* HungerRush 3-swoosh logo */}
            <div className="flex justify-center">
              <svg
                className="h-10 w-10 text-[#009ca6]"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 16C4 9.37258 9.37258 4 16 4C20.4183 4 24.2678 6.38198 26.3421 9.93245"
                  stroke="currentColor"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
                <path
                  d="M7 19C7 14.0294 11.0294 10 16 10C19.3137 10 22.2009 11.7865 23.7566 14.4493"
                  stroke="currentColor"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  opacity="0.8"
                />
                <path
                  d="M10 22C10 18.6863 12.6863 16 16 16C18.2091 16 20.1339 17.191 21.1711 18.9662"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  opacity="0.6"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Cadence</h1>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#009ca6] mt-0.5">
                HungerRush
              </p>
            </div>
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
