import nodemailer from "nodemailer";
import type { ResolvedMailSettings } from "@/lib/mailSettings";
import type { MailProviderAdapter, SingleEmailParams, SendResult, ConnectionTestResult } from "./types";

// cPanel-hosted mailboxes are just standard SMTP accounts, so this works for
// any cPanel email (e.g. mail.yourdomain.com, port 465 SSL or 587 STARTTLS)
// as well as any other plain SMTP provider.
function buildTransport(settings: ResolvedMailSettings) {
  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort || 465,
    secure: settings.smtpSecure, // true for 465 (SSL), false for 587/25 (STARTTLS)
    auth: {
      user: settings.smtpUsername,
      pass: settings.smtpPassword,
    },
  });
}

async function sendSingleEmail(settings: ResolvedMailSettings, params: SingleEmailParams): Promise<SendResult> {
  const transport = buildTransport(settings);
  const toAddresses = Array.isArray(params.to) ? params.to.join(", ") : params.to;

  const info = await transport.sendMail({
    from: `${settings.fromName} <${settings.fromEmail}>`,
    to: toAddresses,
    subject: params.subject,
    ...(params.htmlBody && { html: params.htmlBody }),
    ...(params.textBody && { text: params.textBody }),
    ...(params.replyTo && { replyTo: params.replyTo }),
  });

  return { messageId: info.messageId };
}

async function testConnection(settings: ResolvedMailSettings): Promise<ConnectionTestResult> {
  try {
    const transport = buildTransport(settings);
    await transport.verify();
    return {
      connected: true,
      detail: `Host: ${settings.smtpHost}:${settings.smtpPort} · From: ${settings.fromEmail}`,
    };
  } catch (err: any) {
    return { connected: false, error: err.message };
  }
}

export const cpanelAdapter: MailProviderAdapter = { sendSingleEmail, testConnection };
