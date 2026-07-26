import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  // NextAuth v5 / Auth.js reads AUTH_SECRET first, falling back to
  // NEXTAUTH_SECRET, when you don't pass `secret` to NextAuth() in auth.ts.
  // getToken() has NO such fallback — it needs the exact secret handed to
  // it, or it throws MissingSecret. If only AUTH_SECRET was set on Vercel
  // (the documented v5 variable name) and not NEXTAUTH_SECRET, this line
  // used to pass `secret: undefined`, which made every request to a
  // protected route throw inside the middleware — i.e. you'd never
  // actually reach /dashboard even with a valid login.
  // Auth.js prefixes its session cookie with "__Secure-" whenever the site
  // is served over HTTPS (which Vercel always is). getToken() doesn't infer
  // that on its own — without `secureCookie: true`, it looks for the plain
  // "authjs.session-token" cookie, never finds it (because the real one is
  // "__Secure-authjs.session-token"), and silently treats every request as
  // logged out. That's what was bouncing valid logins straight back to
  // /login: the credentials POST succeeded and set the cookie, but this
  // middleware couldn't see it on the very next request.
  const secureCookie = req.nextUrl.protocol === "https:";

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    secureCookie,
  });

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/send/:path*", "/api/test-connection/:path*"],
};
