import { NextRequest, NextResponse } from "next/server";
import { promises as dns } from "dns";
import { auth } from "@/lib/auth";
import { isValidEmailFormat, normalizeEmail, domainOf } from "@/lib/emailValidation";
import { getSuppressedSet } from "@/lib/suppressions";

export const maxDuration = 60;
export const runtime = "nodejs"; // needs Node's dns module — not available on the edge runtime

type BadEntry = { email: string; reasons: string[] };

// One MX lookup per unique domain, not per recipient — a list of 5,000
// addresses is typically only a few hundred distinct domains (gmail.com,
// yahoo.com, etc. repeat constantly), so this is the difference between
// a handful of DNS queries and thousands of them.
async function domainsWithMx(domains: string[]): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  const CONCURRENCY = 20;
  let i = 0;

  async function worker() {
    while (i < domains.length) {
      const domain = domains[i++];
      try {
        const records = await dns.resolveMx(domain);
        result.set(domain, records.length > 0);
      } catch {
        // ENOTFOUND / ENODATA / timeout — treat any lookup failure as
        // "no mail servers found". A transient DNS hiccup wrongly
        // flagging a domain is a much smaller cost than silently sending
        // to a typo'd domain that will hard-bounce.
        result.set(domain, false);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, domains.length) }, worker));
  return result;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const rawRows: any[] = Array.isArray(body.recipients)
      ? body.recipients
      : Array.isArray(body.emails)
        ? body.emails.map((e: string) => ({ email: e }))
        : [];

    if (rawRows.length === 0)
      return NextResponse.json({ error: "No recipients provided." }, { status: 400 });

    const good: any[] = [];
    const bad: BadEntry[] = [];
    const seen = new Set<string>();
    const formatOk: { row: any; email: string }[] = [];

    // Pass 1: format + duplicates (instant, no network/DB needed)
    for (const row of rawRows) {
      const rawEmail = typeof row === "string" ? row : row?.email;
      const email = normalizeEmail(String(rawEmail || ""));

      if (!email) { bad.push({ email: rawEmail || "(blank)", reasons: ["Blank / missing email"] }); continue; }
      if (!isValidEmailFormat(email)) { bad.push({ email, reasons: ["Invalid email format"] }); continue; }
      if (seen.has(email)) { bad.push({ email, reasons: ["Duplicate"] }); continue; }

      seen.add(email);
      formatOk.push({ row, email });
    }

    // Pass 2: MX records, batched per unique domain
    const uniqueDomains = Array.from(new Set(formatOk.map(({ email }) => domainOf(email))));
    const mxByDomain = await domainsWithMx(uniqueDomains);

    // Pass 3: suppression list (past bounces + manually-added addresses)
    const suppressed = await getSuppressedSet(formatOk.map(({ email }) => email));

    const REASON_LABEL: Record<string, string> = {
      INVALID_FORMAT: "Previously flagged: invalid format",
      INVALID_DOMAIN: "Previously flagged: domain has no mail servers",
      BOUNCED: "Previously bounced",
      MANUAL: "On suppression list",
    };

    for (const { row, email } of formatOk) {
      const reasons: string[] = [];
      if (!mxByDomain.get(domainOf(email))) reasons.push("Domain has no mail servers (MX lookup failed)");
      const suppression = suppressed.get(email);
      if (suppression) reasons.push(`${REASON_LABEL[suppression.reason] || "On suppression list"}${suppression.detail ? ` — ${suppression.detail}` : ""}`);

      if (reasons.length) {
        bad.push({ email, reasons });
      } else {
        good.push(typeof row === "string" ? { email } : { ...row, email });
      }
    }

    return NextResponse.json({
      total: rawRows.length,
      goodCount: good.length,
      badCount: bad.length,
      good,
      bad,
    });
  } catch (err: any) {
    console.error("POST /api/validate-emails failed:", err);
    return NextResponse.json({ error: err.message || "Validation failed." }, { status: 500 });
  }
}
