import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { testConnection } from "@/lib/mailer";

// Tests the given domain's mail-provider connection, or the default
// domain when no ?domainId= is given (e.g. the Dashboard status banner).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const domainId = req.nextUrl.searchParams.get("domainId") || undefined;

  try {
    const result = await testConnection(domainId);
    return NextResponse.json(result, { status: result.connected ? 200 : 500 });
  } catch (err: any) {
    return NextResponse.json({ connected: false, error: err.message }, { status: 500 });
  }
}
