import type { ResolvedMailSettings } from "@/lib/mailSettings";

export interface SingleEmailParams {
  to: string | string[];
  subject: string;
  htmlBody?: string;
  textBody?: string;
  replyTo?: string;
}

export interface BulkRecipient {
  email: string;
  name?: string;
  [key: string]: string | undefined;
}

export interface SendResult {
  messageId?: string;
}

export interface ConnectionTestResult {
  connected: boolean;
  detail?: string;
  error?: string;
}

export interface MailProviderAdapter {
  sendSingleEmail(settings: ResolvedMailSettings, params: SingleEmailParams): Promise<SendResult>;
  testConnection(settings: ResolvedMailSettings): Promise<ConnectionTestResult>;

  // Optional: providers with a native multi-recipient batch endpoint (e.g.
  // Resend's POST /emails/batch, up to 100 emails per call) can implement
  // this to send a whole campaign in a handful of API requests instead of
  // one request per recipient. This is both faster and far less likely to
  // trip a requests-per-second rate limit. Adapters without a batch
  // endpoint (SES, cPanel/SMTP) simply omit it, and sendBulkEmails() in
  // lib/mailer.ts falls back to a paced, retrying per-recipient loop.
  sendBulk?(settings: ResolvedMailSettings, items: BulkSendItem[]): Promise<BulkSendItemResult[]>;
}

export interface BulkSendItem {
  to: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  replyTo?: string;
}

export interface BulkSendItemResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}
