import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Subclassing CredentialsSignin (rather than just returning null from
// authorize) lets us attach a specific `code` that survives the round trip
// to the client via signIn()'s `res.code`, so the login page can show a
// tailored message instead of one generic "invalid" string for everything.
// The `code` itself is safe to expose (it's a short label, not a stack
// trace or DB detail) — see CredentialsSignin's own docs on that property.
class MissingCredentialsError extends CredentialsSignin {
  code = "missing-credentials";
}
class InvalidCredentialsError extends CredentialsSignin {
  code = "invalid-credentials";
}
class AccountInactiveError extends CredentialsSignin {
  code = "account-inactive";
}
class AuthServerError extends CredentialsSignin {
  code = "server-error";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const password = credentials?.password as string;
        if (!email || !password) throw new MissingCredentialsError();

        let user;
        try {
          user = await prisma.user.findUnique({ where: { email } });
        } catch (err) {
          console.error("Login DB lookup failed:", err);
          throw new AuthServerError();
        }

        // Deliberately the same error for "no such user" and "wrong
        // password" below — distinguishing them would let an attacker
        // enumerate valid emails.
        if (!user) throw new InvalidCredentialsError();
        if (!user.isActive) throw new AccountInactiveError();

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) throw new InvalidCredentialsError();

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
});
