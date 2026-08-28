import { signIn } from "@/lib/auth";
import { env } from "@/lib/env";
import { LoginForm } from "./login-form";
import { SSOButton } from "./sso-button";

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
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Cadence</h1>
          <p className="text-sm text-muted-foreground">
            {entraConfigured ? "Sign in with your HungerRush account" : "Development Login"}
          </p>
        </div>

        {entraConfigured && <SSOButton action={handleSSO} />}

        {showDevLogin && <LoginForm />}
      </div>
    </div>
  );
}
