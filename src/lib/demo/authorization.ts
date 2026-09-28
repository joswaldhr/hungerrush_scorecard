import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { canAccessDemo } from "./access";

/** Recheck on every page and server action; layouts alone do not secure actions. */
export async function requireDemoAccess() {
  const session = await auth();
  if (!session?.user) redirect("/login?destination=demo");
  if (
    !canAccessDemo(session.user.email, {
      enabled: process.env.CADENCE_DEMO_ENABLED,
      allowedEmails: process.env.CADENCE_DEMO_ALLOWED_EMAILS,
      deployment: process.env.VERCEL_ENV,
    })
  )
    notFound();
  return session.user;
}
