import { SESClient, SendEmailCommand, SendBulkTemplatedEmailCommand } from "@aws-sdk/client-ses";

export const sesClient = new SESClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export interface SingleEmailParams {
  to: string | string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  replyTo?: string;
}

export interface BulkRecipient {
  email: string;
  name?: string;
  [key: string]: string | undefined;
}

export async function sendSingleEmail(params: SingleEmailParams) {
  const toAddresses = Array.isArray(params.to) ? params.to : [params.to];

  const command = new SendEmailCommand({
    Source: `${process.env.SES_FROM_NAME} <${process.env.SES_FROM_EMAIL}>`,
    Destination: { ToAddresses: toAddresses },
    Message: {
      Subject: { Data: params.subject, Charset: "UTF-8" },
      Body: {
        Html: { Data: params.htmlBody, Charset: "UTF-8" },
        ...(params.textBody && { Text: { Data: params.textBody, Charset: "UTF-8" } }),
      },
    },
    ...(params.replyTo && { ReplyToAddresses: [params.replyTo] }),
  });

  return sesClient.send(command);
}

export async function sendBulkEmails(
  recipients: BulkRecipient[],
  subject: string,
  htmlTemplate: string,
  onProgress?: (sent: number, total: number) => void
) {
  const results = { sent: 0, failed: 0, errors: [] as string[] };
  const BATCH_SIZE = 14; // SES rate: 14/sec on sandbox, adjust for production

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async (recipient) => {
        try {
          // Personalise template with recipient data
          let personalised = htmlTemplate;
          Object.entries(recipient).forEach(([key, value]) => {
            personalised = personalised.replace(new RegExp(`{{${key}}}`, "g"), value || "");
          });

          await sendSingleEmail({
            to: recipient.email,
            subject,
            htmlBody: personalised,
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
