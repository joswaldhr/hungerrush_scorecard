import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DEV_USERS } from "./dev-users";

if (process.env.NODE_ENV === "production") {
  if (!process.env.AUTH_PROVIDER || process.env.AUTH_PROVIDER === "credentials") {
    console.warn("Credentials provider is active in production. Configure a proper SSO provider.");
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
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
