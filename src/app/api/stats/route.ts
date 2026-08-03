import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Real dashboard metrics derived from EmailLog, replacing the hardcoded
// "—" placeholders that never had any data wired up.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totals, todayTotals, logs] = await Promise.all([
      prisma.emailLog.aggregate({ _sum: { totalSent: true, totalFailed: true } }),
      prisma.emailLog.aggregate({
        _sum: { totalSent: true, totalFailed: true },
        where: { sentAt: { gte: startOfToday } },
      }),
      // Only pull the recipients field — this dataset is small enough
      // (email addresses per campaign) to dedupe in memory rather than
      // needing a separate aggregation pipeline.
      prisma.emailLog.findMany({ select: { recipients: true } }),
    ]);

    const emailsSent = totals._sum.totalSent ?? 0;
    const emailsFailed = totals._sum.totalFailed ?? 0;
    const attempted = emailsSent + emailsFailed;
    const deliveryRate = attempted > 0 ? Math.round((emailsSent / attempted) * 1000) / 10 : null;

    const uniqueRecipients = new Set<string>();
    for (const log of logs) {
      for (const r of log.recipients) uniqueRecipients.add(r.trim().toLowerCase());
    }

    return NextResponse.json({
      emailsSent,
      emailsFailed,
      deliveryRate, // percentage 0-100, or null if nothing sent yet
      uniqueRecipients: uniqueRecipients.size,
      sentToday: todayTotals._sum.totalSent ?? 0,
    });
  } catch (err: any) {
    console.error("GET /api/stats failed:", err);
    return NextResponse.json(
      { error: "Could not load stats. Check DATABASE_URL / network access and try again." },
      { status: 500 }
    );
  }
}
