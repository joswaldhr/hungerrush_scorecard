import { signIn } from "@/lib/auth";
import { env } from "@/lib/env";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  const entraConfigured = Boolean(
    env.AUTH_MICROSOFT_ENTRA_ID_ID && env.AUTH_MICROSOFT_ENTRA_ID_SECRET
  );
  const showDevLogin = process.env.NODE_ENV !== "production";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Cadence</h1>
          <p className="text-sm text-muted-foreground">
            {entraConfigured ? "Sign in with your HungerRush account" : "Development Login"}
          </p>
        </div>

        {entraConfigured && (
          <form
            action={async () => {
              "use server";
              await signIn("microsoft-entra-id", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Sign in with Microsoft
            </button>
          </form>
        )}

        {showDevLogin && <LoginForm />}
      </div>
    </div>
  );
}
