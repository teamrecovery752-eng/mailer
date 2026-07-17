import { getMailSettings } from "@/lib/mailSettings";
import { sesAdapter } from "@/lib/providers/ses";
import { cpanelAdapter } from "@/lib/providers/cpanel";
import type { BulkRecipient, SingleEmailParams, ConnectionTestResult } from "@/lib/providers/types";

export type { SingleEmailParams, BulkRecipient };

function adapterFor(provider: "SES" | "CPANEL") {
  return provider === "CPANEL" ? cpanelAdapter : sesAdapter;
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
  const BATCH_SIZE = 14; // conservative default; SES sandbox is 14/sec, most SMTP hosts are similar or slower

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async (recipient) => {
        try {
          await adapter.sendSingleEmail(settings, {
            to: recipient.email,
            subject,
            ...(template.htmlBody && { htmlBody: personalise(template.htmlBody, recipient) }),
            ...(template.textBody && { textBody: personalise(template.textBody, recipient) }),
          });
          results.sent++;
        } catch (err: any) {
          results.failed++;
          results.errors.push(`${recipient.email}: ${err.message}`);
        }
      })
    );

    onProgress?.(Math.min(i + BATCH_SIZE, recipients.length), recipients.length);

    // Throttle between batches
    if (i + BATCH_SIZE < recipients.length) {
      await new Promise((r) => setTimeout(r, 1100));
    }
  }

  return results;
}
