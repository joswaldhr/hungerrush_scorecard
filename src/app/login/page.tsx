import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Cadence</h1>
          <p className="text-sm text-muted-foreground">Development Login</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
