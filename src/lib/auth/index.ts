import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { DEV_USERS } from "./dev-users";
import { env } from "@/lib/env";

const entraConfigured = Boolean(
  env.AUTH_MICROSOFT_ENTRA_ID_ID && env.AUTH_MICROSOFT_ENTRA_ID_SECRET
);

if (process.env.NODE_ENV === "production" && !entraConfigured) {
  throw new Error(
    "Microsoft Entra ID is not configured in production (AUTH_MICROSOFT_ENTRA_ID_ID/SECRET missing) — the Credentials provider is disabled in production, so the app would boot with no working sign-in method. Refusing to start rather than deploying silently broken."
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    ...(entraConfigured
      ? [
          MicrosoftEntraID({
            clientId: env.AUTH_MICROSOFT_ENTRA_ID_ID,
            clientSecret: env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
            issuer: env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
          }),
        ]
      : []),
    Credentials({
      name: "Development Login",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "alexander.smith@hungerrush.com" },
      },
      async authorize(credentials) {
        if (process.env.NODE_ENV === "production") {
          return null;
        }
        const email = credentials?.email;
        if (typeof email !== "string") return null;
        const user = DEV_USERS.find((u) => u.email === email);
        if (!user) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth: session }) {
      return !!session?.user;
    },
  },
});
