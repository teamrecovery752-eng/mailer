import { resolveDomain } from "@/lib/domains";
import type { ResolvedDomain } from "@/lib/domains";
import { sesAdapter } from "@/lib/providers/ses";
import { cpanelAdapter } from "@/lib/providers/cpanel";
import { resendAdapter } from "@/lib/providers/resend";
import type { BulkRecipient, SingleEmailParams, ConnectionTestResult } from "@/lib/providers/types";

export type { SingleEmailParams, BulkRecipient };

function adapterFor(provider: "SES" | "CPANEL" | "RESEND") {
  if (provider === "CPANEL") return cpanelAdapter;
  if (provider === "RESEND") return resendAdapter;
  return sesAdapter;
}

// Domain-level merge tags, resolved once per send (same value for every
// recipient) — this is what lets a single template work across every
// configured domain instead of hardcoding one brand's name/links/address.
// Recipient-level tags ({{name}}, {{email}}, CSV columns, …) are applied
// separately, per-recipient, in sendBulkEmails below.
const BRAND_TOKENS: Record<string, keyof ResolvedDomain> = {
  companyName: "companyName",
  website: "website",
  contactUrl: "contactUrl",
  address: "address",
  accentColor: "accentColor",
  unsubscribeText: "unsubscribeText",
};

function withBranding(text: string | undefined, domain: ResolvedDomain): string | undefined {
  if (!text) return text;
  let out = text;
  for (const [tag, field] of Object.entries(BRAND_TOKENS)) {
    const value = String(domain[field] ?? "");
    out = out.replace(new RegExp(`{{\\s*${tag}\\s*}}`, "g"), value);
  }
  return out;
}

// Appends the saved signature (built in Settings from an uploaded .html
// file, pasted HTML code, or an uploaded picture — all resolve down to
// the same signatureHtml string) to an outgoing htmlBody. Runs here, in
// the one place both single and bulk sends funnel through, so every
// provider and every compose screen gets it automatically with no
// per-page wiring. No-ops when the signature is off, empty, or the
// email has no HTML part (plain-text-only sends are left alone).
function withSignature(htmlBody: string | undefined, domain: ResolvedDomain): string | undefined {
  if (!htmlBody || !domain.signatureEnabled || !domain.signatureHtml.trim()) return htmlBody;

  const block = `<div style="margin-top:32px">${domain.signatureHtml}</div>`;
  // Insert just before </body> when present so it stays inside the
  // document instead of trailing after a closing </html> tag; otherwise
  // (fragment-style bodies with no <html>/<body> wrapper) just append.
  return /<\/body>/i.test(htmlBody)
    ? htmlBody.replace(/<\/body>/i, `${block}</body>`)
    : `${htmlBody}${block}`;
}

export async function sendSingleEmail(params: SingleEmailParams & { domainId?: string }) {
  const domain = await resolveDomain(params.domainId);
  const adapter = adapterFor(domain.active);
  return adapter.sendSingleEmail(domain, {
    ...params,
    htmlBody: withSignature(withBranding(params.htmlBody, domain), domain),
    textBody: withBranding(params.textBody, domain),
    replyTo: params.replyTo || domain.replyTo || undefined,
  });
}

export async function testConnection(domainId?: string): Promise<ConnectionTestResult & { provider: string; fromEmail: string; domainLabel: string }> {
  const domain = await resolveDomain(domainId);
  const adapter = adapterFor(domain.active);
  const result = await adapter.testConnection(domain);
  return { ...result, provider: domain.active, fromEmail: domain.fromEmail, domainLabel: domain.label };
}

export interface BulkTemplate {
  htmlBody?: string;
  textBody?: string;
}

function personalise(template: string, recipient: BulkRecipient) {
  let out = template;
  Object.entries(recipient).forEach(([key, value]) => {
    out = out.replace(new RegExp(`{{${key}}}`, "g"), value || "");
  });
  return out;
}

export async function sendBulkEmails(
  recipients: BulkRecipient[],
  subject: string,
  template: BulkTemplate,
  onProgress?: (sent: number, total: number) => void,
  domainId?: string
) {
  const domain = await resolveDomain(domainId);
  const adapter = adapterFor(domain.active);
  const results = { sent: 0, failed: 0, errors: [] as string[] };

  // Apply domain-level branding + the signature once, before per-recipient
  // personalisation — none of these have per-recipient merge tags, so
  // there's no reason to redo them for every row.
  const htmlTemplate = withSignature(withBranding(template.htmlBody, domain), domain);
  const textTemplate = withBranding(template.textBody, domain);
  const replyTo = domain.replyTo || undefined;

  // Providers with a native batch-send endpoint (currently Resend) deliver
  // the whole campaign in a handful of API calls instead of one call per
  // recipient — far less likely to trip a requests-per-second rate limit.
  if (adapter.sendBulk) {
    const items = recipients.map((r) => ({
      to: r.email,
      subject,
      ...(htmlTemplate && { htmlBody: personalise(htmlTemplate, r) }),
      ...(textTemplate && { textBody: personalise(textTemplate, r) }),
      ...(replyTo && { replyTo }),
    }));

    const outcomes = await adapter.sendBulk(domain, items);
    outcomes.forEach((outcome, i) => {
      if (outcome.ok) {
        results.sent++;
      } else {
        results.failed++;
        results.errors.push(`${recipients[i].email}: ${outcome.error || "Send failed"}`);
      }
    });

    onProgress?.(recipients.length, recipients.length);
    return results;
  }

  // Fallback for providers without a batch endpoint (SES, cPanel/SMTP):
  // one request per recipient, paced conservatively per-provider, with a
  // short retry on transient rate-limit errors before giving up.
  const BATCH_SIZE = domain.active === "CPANEL" ? 5 : 14; // SES sandbox ~14/sec; SMTP hosts are usually slower
  const MAX_RETRIES = 2;

  async function sendOne(recipient: BulkRecipient, attempt = 0): Promise<void> {
    try {
      await adapter.sendSingleEmail(domain, {
        to: recipient.email,
        subject,
        ...(htmlTemplate && { htmlBody: personalise(htmlTemplate, recipient) }),
        ...(textTemplate && { textBody: personalise(textTemplate, recipient) }),
        ...(replyTo && { replyTo }),
      });
      results.sent++;
    } catch (err: any) {
      const message = err?.message || "Send failed";
      const isRateLimited = /rate limit|too many requests|429/i.test(message);
      if (isRateLimited && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
        return sendOne(recipient, attempt + 1);
      }
      results.failed++;
      results.errors.push(`${recipient.email}: ${message}`);
    }
  }

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(batch.map((r) => sendOne(r)));
    onProgress?.(Math.min(i + BATCH_SIZE, recipients.length), recipients.length);

    if (i + BATCH_SIZE < recipients.length) {
      await new Promise((r) => setTimeout(r, 1100));
    }
  }

  return results;
}
