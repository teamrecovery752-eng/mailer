import { prisma } from "@/lib/prisma";
import type { Domain, MailProvider } from "@prisma/client";

export type ResolvedDomain = Domain;

export interface DomainInput {
  label: string;
  domain: string;
  isActive?: boolean;
  isDefault?: boolean;
  active: MailProvider;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  sesRegion: string;
  sesAccessKeyId: string;
  sesSecretAccessKey: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword: string;
  resendApiKey: string;
  companyName: string;
  website: string;
  contactUrl: string;
  address: string;
  accentColor: string;
  unsubscribeText: string;
  signatureEnabled: boolean;
  signatureHtml: string;
}

export async function getDomains(): Promise<Domain[]> {
  return prisma.domain.findMany({ orderBy: [{ isDefault: "desc" }, { label: "asc" }] });
}

export async function getDomainById(id: string): Promise<Domain | null> {
  return prisma.domain.findUnique({ where: { id } });
}

// The domain used whenever a send/test doesn't explicitly pick one.
// Prefers the domain flagged isDefault; falls back to the first active
// domain if the flag somehow isn't set on anything (shouldn't normally
// happen — createDomain/setDefaultDomain keep exactly one default).
export async function getDefaultDomain(): Promise<Domain | null> {
  const def = await prisma.domain.findFirst({ where: { isDefault: true } });
  if (def) return def;
  return prisma.domain.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
}

// Resolves a specific domain by id, or the default domain when no id is
// given. Throws a clear, user-facing error rather than letting a null
// settings object crash deep inside a provider adapter.
export async function resolveDomain(domainId?: string | null): Promise<Domain> {
  const domain = domainId ? await getDomainById(domainId) : await getDefaultDomain();
  if (!domain) {
    throw new Error(
      domainId
        ? "That sending domain no longer exists. Pick another one and try again."
        : "No sending domain is configured yet. Add one in Settings before sending."
    );
  }
  if (!domain.isActive) {
    throw new Error(`The "${domain.label}" domain is disabled. Enable it in Settings or pick another domain.`);
  }
  return domain;
}

// Ensures at most one domain is flagged isDefault at a time. Runs before
// create/update whenever the incoming data sets isDefault = true.
async function clearOtherDefaults(exceptId?: string) {
  await prisma.domain.updateMany({
    where: { isDefault: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
    data: { isDefault: false },
  });
}

export async function createDomain(data: DomainInput): Promise<Domain> {
  const count = await prisma.domain.count();
  // The very first domain is always the default — otherwise nothing would
  // be selected when a send doesn't specify one.
  const isDefault = count === 0 ? true : !!data.isDefault;
  if (isDefault) await clearOtherDefaults();

  return prisma.domain.create({
    data: {
      label: data.label,
      domain: data.domain,
      isActive: data.isActive ?? true,
      isDefault,
      active: data.active,
      fromName: data.fromName,
      fromEmail: data.fromEmail,
      replyTo: data.replyTo || "",
      sesRegion: data.sesRegion,
      sesAccessKeyId: data.sesAccessKeyId,
      sesSecretAccessKey: data.sesSecretAccessKey,
      smtpHost: data.smtpHost,
      smtpPort: data.smtpPort,
      smtpSecure: data.smtpSecure,
      smtpUsername: data.smtpUsername,
      smtpPassword: data.smtpPassword,
      resendApiKey: data.resendApiKey,
      companyName: data.companyName,
      website: data.website,
      contactUrl: data.contactUrl,
      address: data.address,
      accentColor: data.accentColor,
      unsubscribeText: data.unsubscribeText,
      signatureEnabled: data.signatureEnabled,
      signatureHtml: data.signatureHtml,
    },
  });
}

export async function updateDomain(id: string, data: Partial<DomainInput>): Promise<Domain> {
  if (data.isDefault) await clearOtherDefaults(id);
  const updated = await prisma.domain.update({ where: { id }, data: data as any });

  // Guard against ending up with zero default domains (e.g. the admin
  // explicitly unset isDefault on the only default one) — promote the
  // next active domain automatically so sends never fall through to
  // "no domain configured" while domains still exist.
  if (data.isDefault === false) {
    const stillHasDefault = await prisma.domain.findFirst({ where: { isDefault: true } });
    if (!stillHasDefault) {
      const fallback = await prisma.domain.findFirst({ where: { isActive: true, id: { not: id } }, orderBy: { createdAt: "asc" } });
      if (fallback) await prisma.domain.update({ where: { id: fallback.id }, data: { isDefault: true } });
    }
  }

  return updated;
}

export async function deleteDomain(id: string): Promise<void> {
  const domain = await prisma.domain.findUnique({ where: { id } });
  await prisma.domain.delete({ where: { id } });

  // If the deleted domain was the default, promote another one (if any
  // are left) so the system always has a usable default when possible.
  if (domain?.isDefault) {
    const fallback = await prisma.domain.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
    if (fallback) await prisma.domain.update({ where: { id: fallback.id }, data: { isDefault: true } });
  }
}

// Strips secrets before sending a domain to the client, but tells the
// client (via booleans, not the value itself) whether each secret is
// actually set — same "blank means keep it" pattern the old singleton
// settings used, now applied per domain.
export function maskDomain(domain: Domain) {
  return {
    ...domain,
    sesSecretAccessKey: domain.sesSecretAccessKey ? "••••••••" : "",
    smtpPassword: domain.smtpPassword ? "••••••••" : "",
    resendApiKey: domain.resendApiKey ? "••••••••" : "",
    secretsConfigured: {
      sesSecretAccessKey: !!domain.sesSecretAccessKey,
      smtpPassword: !!domain.smtpPassword,
      resendApiKey: !!domain.resendApiKey,
    },
  };
}

export function maskDomains(domains: Domain[]) {
  return domains.map(maskDomain);
}

// Single source of truth for "is this domain actually ready to send",
// used both server-side (to refuse saving/activating an incomplete
// domain) and mirrored client-side (to block the Save button early with
// a clear message instead of a mysterious auth failure later).
export function missingCredentialFields(domain: {
  active: MailProvider;
  fromName: string;
  fromEmail: string;
  sesRegion: string;
  sesAccessKeyId: string;
  sesSecretAccessKey: string;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  resendApiKey: string;
}): string[] {
  const missing: string[] = [];
  if (!domain.fromName.trim()) missing.push("From Name");
  if (!domain.fromEmail.trim()) missing.push("From Email");

  if (domain.active === "SES") {
    if (!domain.sesRegion.trim()) missing.push("AWS Region");
    if (!domain.sesAccessKeyId.trim()) missing.push("Access Key ID");
    if (!domain.sesSecretAccessKey.trim()) missing.push("Secret Access Key");
  } else if (domain.active === "CPANEL") {
    if (!domain.smtpHost.trim()) missing.push("SMTP Host");
    if (!domain.smtpPort) missing.push("Port");
    if (!domain.smtpUsername.trim()) missing.push("Username");
    if (!domain.smtpPassword.trim()) missing.push("Password");
  } else if (domain.active === "RESEND") {
    if (!domain.resendApiKey.trim()) missing.push("API Key");
  }
  return missing;
}
