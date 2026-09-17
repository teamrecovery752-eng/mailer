import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendBulkEmails } from "@/lib/mailer";
import { resolveDomain } from "@/lib/domains";
import { recordBounces } from "@/lib/suppressions";
import { prisma } from "@/lib/prisma";

// Bulk campaigns can take a while even when paced/batched correctly.
// 60s is the highest value Vercel's Hobby plan allows; raise this
// (e.g. 300) if you're on Pro/Enterprise and send very large lists.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { recipients, subject, htmlBody, textBody, domainId } = await req.json();

    if (!recipients?.length || !subject || (!htmlBody && !textBody))
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    if (recipients.length > 10000)
      return NextResponse.json({ error: "Maximum 10,000 recipients per batch" }, { status: 400 });

    const domain = await resolveDomain(domainId);
    const results = await sendBulkEmails(recipients, subject, { htmlBody, textBody }, undefined, domain.id);

    const status = results.failed === 0 ? "SUCCESS" : results.sent === 0 ? "FAILED" : "PARTIAL";

    // Log to MongoDB
    await prisma.emailLog.create({
      data: {
        userId: (session.user as any).id,
        type: "BULK",
        status,
        subject,
        recipients: recipients.map((r: any) => r.email),
        totalSent: results.sent,
        totalFailed: results.failed,
        errors: results.errors.slice(0, 50), // cap stored errors
        domainId: domain.id,
        domainLabel: domain.label,
      },
    });

    // Feed every failed address back into the suppression list — best
    // effort, never lets a logging hiccup affect the send response.
    recordBounces(results.errors, domain.label).catch(() => {});

    return NextResponse.json({ success: true, ...results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
