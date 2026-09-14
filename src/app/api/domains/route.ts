import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDomains, createDomain, maskDomains, missingCredentialFields } from "@/lib/domains";

// GET all configured domains (secrets masked). Any authenticated user can
// see the list — they need it to pick a domain on Single/Bulk send — but
// raw credentials are never sent down.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const domains = await getDomains();
    return NextResponse.json(maskDomains(domains));
  } catch (err: any) {
    console.error("GET /api/domains failed:", err);
    return NextResponse.json(
      { error: "Could not reach the database. Check DATABASE_URL / network access and try again." },
      { status: 500 }
    );
  }
}

// POST create a new domain (admin only).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();

    if (!body.label?.trim() || !body.domain?.trim())
      return NextResponse.json({ error: "Label and domain are required." }, { status: 400 });

    const activeValues = ["SES", "CPANEL", "RESEND"];
    const trim = (v: unknown) => (typeof v === "string" ? v.trim() : "");

    const data = {
      label: trim(body.label),
      domain: trim(body.domain).toLowerCase(),
      isActive: body.isActive ?? true,
      isDefault: !!body.isDefault,
      active: activeValues.includes(body.active) ? body.active : "SES",
      fromName: trim(body.fromName),
      fromEmail: trim(body.fromEmail),
      replyTo: trim(body.replyTo),

      sesRegion: trim(body.sesRegion) || "us-east-1",
      sesAccessKeyId: trim(body.sesAccessKeyId),
      sesSecretAccessKey: trim(body.sesSecretAccessKey),

      smtpHost: trim(body.smtpHost),
      smtpPort: body.smtpPort ? Number(body.smtpPort) : 465,
      smtpSecure: body.smtpSecure ?? true,
      smtpUsername: trim(body.smtpUsername),
      smtpPassword: trim(body.smtpPassword),

      resendApiKey: trim(body.resendApiKey),

      companyName: trim(body.companyName),
      website: trim(body.website),
      contactUrl: trim(body.contactUrl),
      address: trim(body.address),
      accentColor: trim(body.accentColor) || "#6366f1",
      unsubscribeText: trim(body.unsubscribeText) || "Reply STOP to unsubscribe",

      signatureEnabled: typeof body.signatureEnabled === "boolean" ? body.signatureEnabled : false,
      signatureHtml: typeof body.signatureHtml === "string" ? body.signatureHtml : "",
    } as const;

    const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024; // 2MB
    if (Buffer.byteLength(data.signatureHtml, "utf8") > MAX_SIGNATURE_BYTES) {
      return NextResponse.json(
        { error: "Signature is too large (max 2MB). Try a smaller or more compressed image." },
        { status: 400 }
      );
    }

    const missing = missingCredentialFields(data as any);
    if (missing.length) {
      return NextResponse.json(
        { error: `Can't save — missing required field${missing.length > 1 ? "s" : ""} for ${data.active}: ${missing.join(", ")}.` },
        { status: 400 }
      );
    }

    const created = await createDomain(data as any);
    return NextResponse.json(maskDomains([created])[0], { status: 201 });
  } catch (err: any) {
    console.error("POST /api/domains failed:", err);
    // Mongo unique-constraint violation on `domain`
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "A domain with that name already exists." }, { status: 409 });
    }
    return NextResponse.json(
      { error: err.message || "Could not create domain. Check DATABASE_URL / network access and try again." },
      { status: 500 }
    );
  }
}
