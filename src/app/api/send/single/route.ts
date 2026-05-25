import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendSingleEmail } from "@/lib/ses";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { to, subject, htmlBody, textBody, replyTo } = await req.json();

    if (!to || !subject || !htmlBody)
      return NextResponse.json({ error: "Missing required fields: to, subject, htmlBody" }, { status: 400 });

    const emails = Array.isArray(to) ? to : [to];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = emails.filter((e: string) => !emailRegex.test(e));
    if (invalid.length > 0)
      return NextResponse.json({ error: `Invalid emails: ${invalid.join(", ")}` }, { status: 400 });

    const result = await sendSingleEmail({ to, subject, htmlBody, textBody, replyTo });

    // Log to MongoDB
    await prisma.emailLog.create({
      data: {
        userId: (session.user as any).id,
        type: "SINGLE",
        status: "SUCCESS",
        subject,
        recipients: emails,
        totalSent: emails.length,
        totalFailed: 0,
        messageId: result.MessageId,
      },
    });

    return NextResponse.json({ success: true, messageId: result.MessageId });
  } catch (err: any) {
    // Log failure
    try {
      const { to, subject } = await req.clone().json().catch(() => ({ to: [], subject: "" }));
      await prisma.emailLog.create({
        data: {
          userId: (session.user as any).id,
          type: "SINGLE",
          status: "FAILED",
          subject: subject || "",
          recipients: Array.isArray(to) ? to : [to],
          totalSent: 0,
          totalFailed: 1,
          errors: [err.message],
        },
      });
    } catch {}
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
