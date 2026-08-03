import { prisma } from "@/lib/prisma";
import type { MailProvider } from "@prisma/client";

export interface ResolvedMailSettings {
  active: MailProvider;
  fromName: string;
  fromEmail: string;
  sesRegion: string;
  sesAccessKeyId: string;
  sesSecretAccessKey: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword: string;
  resendApiKey: string;
}

// There should only ever be one MailSettings document. This finds it,
// or creates it (seeded from legacy env vars so existing SES deployments
// keep working without any manual setup step).
export async function getMailSettings(): Promise<ResolvedMailSettings> {
  const existing = await prisma.mailSettings.findFirst();
  if (existing) return existing;

  const created = await prisma.mailSettings.create({
    data: {
      active: "SES",
      fromName: process.env.SES_FROM_NAME || "",
      fromEmail: process.env.SES_FROM_EMAIL || "",
      sesRegion: process.env.AWS_REGION || "us-east-1",
      sesAccessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      sesSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      resendApiKey: process.env.RESEND_API_KEY || "",
    },
  });
  return created;
}

export async function updateMailSettings(data: Partial<ResolvedMailSettings>) {
  const existing = await prisma.mailSettings.findFirst();
  if (existing) {
    return prisma.mailSettings.update({ where: { id: existing.id }, data });
  }
  return prisma.mailSettings.create({ data: { active: "SES", ...data } });
}

// Strips secrets before sending settings to the client, but tells the
// client (via booleans, not the value itself) whether each secret is
// actually set. Without this, a blank password field looks identical
// whether it's "already saved, blank = keep it" or "never configured,
// blank = provider will fail" — which is what let people switch
// providers and unknowingly save/activate one with missing credentials.
export function maskSettings(settings: ResolvedMailSettings) {
  return {
    ...settings,
    sesSecretAccessKey: settings.sesSecretAccessKey ? "••••••••" : "",
    smtpPassword: settings.smtpPassword ? "••••••••" : "",
    resendApiKey: settings.resendApiKey ? "••••••••" : "",
    secretsConfigured: {
      sesSecretAccessKey: !!settings.sesSecretAccessKey,
      smtpPassword: !!settings.smtpPassword,
      resendApiKey: !!settings.resendApiKey,
    },
  };
}

// Single source of truth for "is this provider actually ready to send",
// used both server-side (to refuse saving/activating an incomplete
// provider) and mirrored client-side (to block the Save button early
// with a clear message instead of a mysterious auth failure later).
export function missingCredentialFields(settings: ResolvedMailSettings): string[] {
  const missing: string[] = [];
  if (!settings.fromName.trim()) missing.push("From Name");
  if (!settings.fromEmail.trim()) missing.push("From Email");

  if (settings.active === "SES") {
    if (!settings.sesRegion.trim()) missing.push("AWS Region");
    if (!settings.sesAccessKeyId.trim()) missing.push("Access Key ID");
    if (!settings.sesSecretAccessKey.trim()) missing.push("Secret Access Key");
  } else if (settings.active === "CPANEL") {
    if (!settings.smtpHost.trim()) missing.push("SMTP Host");
    if (!settings.smtpPort) missing.push("Port");
    if (!settings.smtpUsername.trim()) missing.push("Username");
    if (!settings.smtpPassword.trim()) missing.push("Password");
  } else if (settings.active === "RESEND") {
    if (!settings.resendApiKey.trim()) missing.push("API Key");
  }
  return missing;
}
