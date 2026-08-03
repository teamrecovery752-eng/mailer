import { Resend } from "resend";
import type { ResolvedMailSettings } from "@/lib/mailSettings";
import type { MailProviderAdapter, SingleEmailParams, SendResult, ConnectionTestResult, BulkSendItem, BulkSendItemResult } from "./types";

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

// Resend's rate limit errors surface as HTTP 429 with an error name of
// "rate_limit_exceeded". The SDK doesn't always forward the raw
// `retry-after` response header onto the error object, so we back off
// exponentially as a safe default and only trust an explicit retry-after
// value when one happens to be present.
function isRateLimitError(err: any): boolean {
  const status = err?.statusCode ?? err?.status;
  return status === 429 || err?.name === "rate_limit_exceeded" || /rate limit|too many requests/i.test(String(err?.message || ""));
}

function retryDelayMs(err: any, attempt: number): number {
  const retryAfterSec = Number(err?.headers?.["retry-after"] ?? err?.retryAfter);
  if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) return retryAfterSec * 1000;
  // 500ms, 1s, 2s, 4s, capped, plus a little jitter so retries don't clump.
  return Math.min(500 * 2 ** attempt, 8000) + Math.random() * 250;
}

const RESEND_BATCH_LIMIT = 100; // hard cap on Resend's POST /emails/batch endpoint
const MAX_BATCH_RETRIES = 4;

// Sends a whole campaign via Resend's native batch endpoint: up to 100
// personalised emails per HTTP request, instead of one request per
// recipient. This is dramatically less likely to hit the 10 req/sec team
// rate limit than the old per-recipient loop, and much faster for large
// sends. On a 429, each chunk is retried with backoff before being marked
// failed.
async function sendBulk(settings: ResolvedMailSettings, items: BulkSendItem[]): Promise<BulkSendItemResult[]> {
  const client = buildClient(settings);
  const results: BulkSendItemResult[] = new Array(items.length);
  const from = `${settings.fromName} <${settings.fromEmail}>`;

  for (let i = 0; i < items.length; i += RESEND_BATCH_LIMIT) {
    const chunk = items.slice(i, i + RESEND_BATCH_LIMIT);
    const payload = chunk.map((item) => ({
      from,
      to: [item.to],
      subject: item.subject,
      ...(item.htmlBody
        ? { html: item.htmlBody, ...(item.textBody && { text: item.textBody }) }
        : { text: item.textBody as string }),
      ...(item.replyTo && { replyTo: item.replyTo }),
    }));

    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await client.batch.send(payload as any);

      if (!error) {
        const sentIds = data?.data ?? [];
        chunk.forEach((_, idx) => {
          results[i + idx] = { ok: true, messageId: sentIds[idx]?.id };
        });
        break;
      }

      if (isRateLimitError(error) && attempt < MAX_BATCH_RETRIES) {
        await new Promise((r) => setTimeout(r, retryDelayMs(error, attempt)));
        attempt++;
        continue;
      }

      // Non-retryable error, or retries exhausted: mark the whole chunk
      // failed with the batch's error message.
      const message = error.message || "Resend batch send failed";
      chunk.forEach((_, idx) => { results[i + idx] = { ok: false, error: message }; });
      break;
    }

    // Small pacing gap between chunks. A single batch call still only
    // counts as one request against the 10 req/sec team-wide limit, so
    // this is a safety margin for other concurrent Resend calls (e.g. a
    // connection test running elsewhere), not a hard requirement.
    if (i + RESEND_BATCH_LIMIT < items.length) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  return results;
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

export const resendAdapter: MailProviderAdapter = { sendSingleEmail, testConnection, sendBulk };
