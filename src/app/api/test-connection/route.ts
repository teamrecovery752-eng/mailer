import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sesClient } from "@/lib/ses";
import { GetAccountSendingEnabledCommand, ListVerifiedEmailAddressesCommand } from "@aws-sdk/client-ses";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const cmd = new GetAccountSendingEnabledCommand({});
    const result = await sesClient.send(cmd);
    return NextResponse.json({
      connected: true,
      sendingEnabled: result.Enabled,
      region: process.env.AWS_REGION,
      fromEmail: process.env.SES_FROM_EMAIL,
    });
  } catch (err: any) {
    return NextResponse.json({ connected: false, error: err.message }, { status: 500 });
  }
}
