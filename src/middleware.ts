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
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
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
