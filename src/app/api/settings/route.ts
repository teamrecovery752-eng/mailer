import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMailSettings, updateMailSettings, maskSettings, missingCredentialFields } from "@/lib/mailSettings";

// GET current mail settings (secrets masked). Any authenticated user can see
// which provider is active, but the raw credentials are never sent down.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const settings = await getMailSettings();
    return NextResponse.json(maskSettings(settings));
  } catch (err: any) {
    console.error("GET /api/settings failed:", err);
    return NextResponse.json(
      { error: "Could not reach the database. Check DATABASE_URL / network access and try again." },
      { status: 500 }
    );
  }
}

// PUT update mail settings (admin only). Any field left blank for a
// password/secret is treated as "keep the existing value" so the admin
// doesn't have to re-enter it every time they just switch providers.
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const current = await getMailSettings();

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
    // commonly drags along a trailing space or newline. That's invisible
    // in a password field but makes SMTP/API auth fail outright (e.g.
    // cPanel's "535 Incorrect authentication data"). Trim every
    // credential-ish field before it's ever saved or used.
    const trim = (v: unknown, fallback: string) => (typeof v === "string" ? v.trim() : fallback);

    const activeValues = ["SES", "CPANEL", "RESEND"];
    const data = {
      active: activeValues.includes(body.active) ? body.active : "SES",
      fromName: trim(body.fromName, current.fromName),
      fromEmail: trim(body.fromEmail, current.fromEmail),

      sesRegion: trim(body.sesRegion, current.sesRegion),
      sesAccessKeyId: trim(body.sesAccessKeyId, current.sesAccessKeyId),
      sesSecretAccessKey: trim(cleanSecret(body.sesSecretAccessKey, current.sesSecretAccessKey), current.sesSecretAccessKey),

      smtpHost: trim(body.smtpHost, current.smtpHost),
      smtpPort: body.smtpPort ? Number(body.smtpPort) : current.smtpPort,
      smtpSecure: body.smtpSecure ?? current.smtpSecure,
      smtpUsername: trim(body.smtpUsername, current.smtpUsername),
      smtpPassword: trim(cleanSecret(body.smtpPassword, current.smtpPassword), current.smtpPassword),

      resendApiKey: trim(cleanSecret(body.resendApiKey, current.resendApiKey), current.resendApiKey),
    } as const;

    // Refuse to save/activate a provider that's missing required
    // credentials — this is what used to let a half-configured provider
    // (e.g. a blank password left blank because a never-set field looked
    // identical to an intentionally-blank "keep existing" one) get saved
    // as the active provider and silently fail on the next send.
    const missing = missingCredentialFields(data as any);
    if (missing.length) {
      return NextResponse.json(
        { error: `Can't save — missing required field${missing.length > 1 ? "s" : ""} for ${data.active}: ${missing.join(", ")}.` },
        { status: 400 }
      );
    }

    const updated = await updateMailSettings(data);
    return NextResponse.json(maskSettings(updated));
  } catch (err: any) {
    console.error("PUT /api/settings failed:", err);
    return NextResponse.json(
      { error: err.message || "Could not save settings. Check DATABASE_URL / network access and try again." },
      { status: 500 }
    );
  }
}
