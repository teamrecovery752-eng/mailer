import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendBulkEmails } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { recipients, subject, htmlBody, textBody } = await req.json();

    if (!recipients?.length || !subject || (!htmlBody && !textBody))
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    if (recipients.length > 10000)
      return NextResponse.json({ error: "Maximum 10,000 recipients per batch" }, { status: 400 });

    const results = await sendBulkEmails(recipients, subject, { htmlBody, textBody });

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
      },
    });

    return NextResponse.json({ success: true, ...results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
