export { auth as proxy } from "@/lib/auth";

export const config = {
  matcher: [
    "/((?!api/auth|api/cron|api/health|login|_next/static|_next/image|favicon.ico|hungerrush-logo.png|hungerrush-logo-reversed.png|hungerrush-mark-reversed.png).*)",
  ],
};
