import { getMailSettings } from "@/lib/mailSettings";
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

export async function sendSingleEmail(params: SingleEmailParams) {
  const settings = await getMailSettings();
  const adapter = adapterFor(settings.active);
  return adapter.sendSingleEmail(settings, params);
}

export async function testConnection(): Promise<ConnectionTestResult & { provider: string; fromEmail: string }> {
  const settings = await getMailSettings();
  const adapter = adapterFor(settings.active);
  const result = await adapter.testConnection(settings);
  return { ...result, provider: settings.active, fromEmail: settings.fromEmail };
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
  onProgress?: (sent: number, total: number) => void
) {
  const settings = await getMailSettings();
  const adapter = adapterFor(settings.active);
  const results = { sent: 0, failed: 0, errors: [] as string[] };

  // Providers with a native batch-send endpoint (currently Resend) deliver
  // the whole campaign in a handful of API calls instead of one call per
  // recipient — far less likely to trip a requests-per-second rate limit.
  if (adapter.sendBulk) {
    const items = recipients.map((r) => ({
      to: r.email,
      subject,
      ...(template.htmlBody && { htmlBody: personalise(template.htmlBody, r) }),
      ...(template.textBody && { textBody: personalise(template.textBody, r) }),
    }));

    const outcomes = await adapter.sendBulk(settings, items);
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
  const BATCH_SIZE = settings.active === "CPANEL" ? 5 : 14; // SES sandbox ~14/sec; SMTP hosts are usually slower
  const MAX_RETRIES = 2;

  async function sendOne(recipient: BulkRecipient, attempt = 0): Promise<void> {
    try {
      await adapter.sendSingleEmail(settings, {
        to: recipient.email,
        subject,
        ...(template.htmlBody && { htmlBody: personalise(template.htmlBody, recipient) }),
        ...(template.textBody && { textBody: personalise(template.textBody, recipient) }),
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
