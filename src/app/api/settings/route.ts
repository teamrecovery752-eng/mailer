import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMailSettings, updateMailSettings, maskSettings } from "@/lib/mailSettings";

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

    const data = {
      active: body.active === "CPANEL" ? "CPANEL" : "SES",
      fromName: body.fromName ?? current.fromName,
      fromEmail: body.fromEmail ?? current.fromEmail,

      sesRegion: body.sesRegion ?? current.sesRegion,
      sesAccessKeyId: body.sesAccessKeyId ?? current.sesAccessKeyId,
      sesSecretAccessKey: body.sesSecretAccessKey || current.sesSecretAccessKey,

      smtpHost: body.smtpHost ?? current.smtpHost,
      smtpPort: body.smtpPort ? Number(body.smtpPort) : current.smtpPort,
      smtpSecure: body.smtpSecure ?? current.smtpSecure,
      smtpUsername: body.smtpUsername ?? current.smtpUsername,
      smtpPassword: body.smtpPassword || current.smtpPassword,
    } as const;

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
