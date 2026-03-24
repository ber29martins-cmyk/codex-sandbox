import { NextResponse } from "next/server";
import { clearBetaSessionCookie } from "../../../../lib/betaSession";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true }, { status: 200 });
  clearBetaSessionCookie(response);
  return response;
}
