import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
// DELETE THIS ROUTE AFTER generating your hash
export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (!password) return NextResponse.json({ error: "No password" }, { status: 400 });
  const hash = await bcrypt.hash(password, 12);
  return NextResponse.json({ hash });
}
