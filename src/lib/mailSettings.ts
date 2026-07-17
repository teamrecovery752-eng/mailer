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

// Strips secrets before sending settings to the client.
export function maskSettings(settings: ResolvedMailSettings) {
  return {
    ...settings,
    sesSecretAccessKey: settings.sesSecretAccessKey ? "••••••••" : "",
    smtpPassword: settings.smtpPassword ? "••••••••" : "",
  };
}
