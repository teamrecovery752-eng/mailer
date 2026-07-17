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
}
