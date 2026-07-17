import { SESClient, SendEmailCommand, GetAccountSendingEnabledCommand } from "@aws-sdk/client-ses";
import type { ResolvedMailSettings } from "@/lib/mailSettings";
import type { MailProviderAdapter, SingleEmailParams, SendResult, ConnectionTestResult } from "./types";

function buildClient(settings: ResolvedMailSettings) {
  return new SESClient({
    region: settings.sesRegion || "us-east-1",
    credentials: {
      accessKeyId: settings.sesAccessKeyId,
      secretAccessKey: settings.sesSecretAccessKey,
    },
  });
}

async function sendSingleEmail(settings: ResolvedMailSettings, params: SingleEmailParams): Promise<SendResult> {
  const toAddresses = Array.isArray(params.to) ? params.to : [params.to];
  const client = buildClient(settings);

  const command = new SendEmailCommand({
    Source: `${settings.fromName} <${settings.fromEmail}>`,
    Destination: { ToAddresses: toAddresses },
    Message: {
      Subject: { Data: params.subject, Charset: "UTF-8" },
      Body: {
        ...(params.htmlBody && { Html: { Data: params.htmlBody, Charset: "UTF-8" } }),
        ...(params.textBody && { Text: { Data: params.textBody, Charset: "UTF-8" } }),
      },
    },
    ...(params.replyTo && { ReplyToAddresses: [params.replyTo] }),
  });

  const result = await client.send(command);
  return { messageId: result.MessageId };
}

async function testConnection(settings: ResolvedMailSettings): Promise<ConnectionTestResult> {
  try {
    const client = buildClient(settings);
    const result = await client.send(new GetAccountSendingEnabledCommand({}));
    return {
      connected: true,
      detail: `Region: ${settings.sesRegion} · Sending ${result.Enabled ? "enabled" : "disabled"} · From: ${settings.fromEmail}`,
    };
  } catch (err: any) {
    return { connected: false, error: err.message };
  }
}

export const sesAdapter: MailProviderAdapter = { sendSingleEmail, testConnection };
