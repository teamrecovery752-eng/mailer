import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listSuppressions, addSuppression } from "@/lib/suppressions";
import { isValidEmailFormat, normalizeEmail } from "@/lib/emailValidation";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await listSuppressions();
  return NextResponse.json(rows);
}

// Bulk-add manually-known-bad addresses — e.g. pasted straight from a
// provider's own suppression dashboard (Resend, SES, etc.) so this list
// stays a superset of whatever they're already tracking.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const raw: string = typeof body.emails === "string" ? body.emails : Array.isArray(body.emails) ? body.emails.join("\n") : "";
    const candidates = raw.split(/[\n,;]+/).map((e) => normalizeEmail(e)).filter(Boolean);

    if (candidates.length === 0)
      return NextResponse.json({ error: "No email addresses provided." }, { status: 400 });

    const valid = candidates.filter(isValidEmailFormat);
    const invalid = candidates.filter((e) => !isValidEmailFormat(e));

    const detail = typeof body.detail === "string" ? body.detail : "";
    await Promise.all(valid.map((email) => addSuppression(email, "MANUAL", detail, "manual")));

    return NextResponse.json({ added: valid.length, skipped: invalid }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/suppressions failed:", err);
    return NextResponse.json({ error: err.message || "Could not add addresses." }, { status: 500 });
  }
}
