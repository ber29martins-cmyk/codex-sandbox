import { NextResponse } from "next/server";
import { isCodeValid } from "@/beta/access";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = typeof body?.code === "string" ? body.code : "";
    const result = isCodeValid(code);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
}
