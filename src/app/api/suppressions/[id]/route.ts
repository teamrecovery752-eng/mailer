import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { removeSuppression } from "@/lib/suppressions";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await removeSuppression(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Could not remove address." }, { status: 500 });
  }
}
