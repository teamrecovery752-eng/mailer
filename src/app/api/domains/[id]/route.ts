import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDomainById, updateDomain, deleteDomain, maskDomain, missingCredentialFields } from "@/lib/domains";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const domain = await getDomainById(id);
  if (!domain) return NextResponse.json({ error: "Domain not found." }, { status: 404 });
  return NextResponse.json(maskDomain(domain));
}

// PUT update a domain (admin only). Any field left blank for a
// password/secret is treated as "keep the existing value" so the admin
// doesn't have to re-enter it every time they just switch providers.
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session || (session.user as any).role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const current = await getDomainById(id);
    if (!current) return NextResponse.json({ error: "Domain not found." }, { status: 404 });

    const body = await req.json();

    // Defense in depth: GET responses replace secrets with "••••••••" so
    // real credentials never round-trip to the browser. If any secret
    // field literally comes back as that mask (e.g. an old cached client,
    // or a form submitted without editing the field), treat it the same
    // as blank — keep the existing value — instead of overwriting the
    // real secret with literal bullet characters.
    const MASK = "••••••••";
    const cleanSecret = (incoming: unknown, existing: string) =>
      typeof incoming === "string" && incoming && incoming !== MASK ? incoming : existing;

    // Credentials are frequently copy-pasted from a provider's dashboard
    // (cPanel's "Connect Devices" page, an AWS console, etc.), which very
    // commonly drags along a trailing space or newline — invisible in a
    // password field but enough to make SMTP/API auth fail outright.
    const trim = (v: unknown, fallback: string) => (typeof v === "string" ? v.trim() : fallback);

    const activeValues = ["SES", "CPANEL", "RESEND"];
    const data = {
      label: trim(body.label, current.label),
      domain: trim(body.domain, current.domain).toLowerCase(),
      isActive: typeof body.isActive === "boolean" ? body.isActive : current.isActive,
      isDefault: typeof body.isDefault === "boolean" ? body.isDefault : current.isDefault,
      active: activeValues.includes(body.active) ? body.active : current.active,
      fromName: trim(body.fromName, current.fromName),
      fromEmail: trim(body.fromEmail, current.fromEmail),
      replyTo: trim(body.replyTo, current.replyTo),

      sesRegion: trim(body.sesRegion, current.sesRegion),
      sesAccessKeyId: trim(body.sesAccessKeyId, current.sesAccessKeyId),
      sesSecretAccessKey: trim(cleanSecret(body.sesSecretAccessKey, current.sesSecretAccessKey), current.sesSecretAccessKey),

      smtpHost: trim(body.smtpHost, current.smtpHost),
      smtpPort: body.smtpPort ? Number(body.smtpPort) : current.smtpPort,
      smtpSecure: typeof body.smtpSecure === "boolean" ? body.smtpSecure : current.smtpSecure,
      smtpUsername: trim(body.smtpUsername, current.smtpUsername),
      smtpPassword: trim(cleanSecret(body.smtpPassword, current.smtpPassword), current.smtpPassword),

      resendApiKey: trim(cleanSecret(body.resendApiKey, current.resendApiKey), current.resendApiKey),

      companyName: trim(body.companyName, current.companyName),
      website: trim(body.website, current.website),
      contactUrl: trim(body.contactUrl, current.contactUrl),
      address: trim(body.address, current.address),
      accentColor: trim(body.accentColor, current.accentColor),
      unsubscribeText: trim(body.unsubscribeText, current.unsubscribeText),

      signatureEnabled: typeof body.signatureEnabled === "boolean" ? body.signatureEnabled : current.signatureEnabled,
      signatureHtml: typeof body.signatureHtml === "string" ? body.signatureHtml : current.signatureHtml,
    } as const;

    const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024; // 2MB
    if (Buffer.byteLength(data.signatureHtml, "utf8") > MAX_SIGNATURE_BYTES) {
      return NextResponse.json(
        { error: "Signature is too large (max 2MB). Try a smaller or more compressed image." },
        { status: 400 }
      );
    }

    // Refuse to save/activate a domain that's missing required credentials
    // for its chosen provider — unless it's being disabled, in which case
    // an incomplete config is fine to keep around for later.
    if (data.isActive) {
      const missing = missingCredentialFields(data as any);
      if (missing.length) {
        return NextResponse.json(
          { error: `Can't save — missing required field${missing.length > 1 ? "s" : ""} for ${data.active}: ${missing.join(", ")}.` },
          { status: 400 }
        );
      }
    }

    const updated = await updateDomain(id, data as any);
    return NextResponse.json(maskDomain(updated));
  } catch (err: any) {
    console.error("PUT /api/domains/[id] failed:", err);
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "A domain with that name already exists." }, { status: 409 });
    }
    return NextResponse.json(
      { error: err.message || "Could not save domain. Check DATABASE_URL / network access and try again." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session || (session.user as any).role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const existing = await getDomainById(id);
    if (!existing) return NextResponse.json({ error: "Domain not found." }, { status: 404 });
    await deleteDomain(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/domains/[id] failed:", err);
    return NextResponse.json({ error: err.message || "Could not delete domain." }, { status: 500 });
  }
}
