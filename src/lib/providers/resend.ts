import { Resend } from "resend";
import type { ResolvedMailSettings } from "@/lib/mailSettings";
import type { MailProviderAdapter, SingleEmailParams, SendResult, ConnectionTestResult } from "./types";

function buildClient(settings: ResolvedMailSettings) {
  return new Resend(settings.resendApiKey);
}

async function sendSingleEmail(settings: ResolvedMailSettings, params: SingleEmailParams): Promise<SendResult> {
  const client = buildClient(settings);
  const toAddresses = Array.isArray(params.to) ? params.to : [params.to];

  if (!params.htmlBody && !params.textBody) {
    throw new Error("sendSingleEmail requires htmlBody or textBody.");
  }

  const base = {
    from: `${settings.fromName} <${settings.fromEmail}>`,
    to: toAddresses,
    subject: params.subject,
    ...(params.replyTo && { replyTo: params.replyTo }),
  };

  // Resend's `send()` type is a discriminated union keyed on which content
  // field is present (html/text/react/template), and it must be provable
  // at compile time — a conditionally-spread `{ ...(x && {html: x}) }`
  // object doesn't satisfy that, so we branch explicitly instead.
  const { data, error } = params.htmlBody
    ? await client.emails.send({
        ...base,
        html: params.htmlBody,
        ...(params.textBody && { text: params.textBody }),
      })
    : await client.emails.send({ ...base, text: params.textBody as string });

  if (error) throw new Error(error.message || "Resend send failed");
  return { messageId: data?.id };
}

async function testConnection(settings: ResolvedMailSettings): Promise<ConnectionTestResult> {
  if (!settings.resendApiKey) {
    return { connected: false, error: "Missing Resend API key." };
  }
  try {
    const client = buildClient(settings);
    // Resend has no dedicated "ping" endpoint, so listing domains both
    // verifies the API key is valid and surfaces whether the sender
    // domain has been added/verified.
    const { data, error } = await client.domains.list();
    if (error) return { connected: false, error: error.message || "Could not reach Resend." };

    const domains = data?.data ?? [];
    const fromDomain = settings.fromEmail.split("@")[1];
    const match = domains.find((d: any) => d.name === fromDomain);

    return {
      connected: true,
      detail: match
        ? `Domain ${fromDomain} · Status: ${match.status} · From: ${settings.fromEmail}`
        : `API key valid, but "${fromDomain}" isn't a verified Resend domain yet · From: ${settings.fromEmail}`,
    };
  } catch (err: any) {
    return { connected: false, error: err.message };
  }
}

export const resendAdapter: MailProviderAdapter = { sendSingleEmail, testConnection };
