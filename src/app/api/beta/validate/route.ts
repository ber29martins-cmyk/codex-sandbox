import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { isCodeValid } from "@/beta/access";
import { betaBindingKey, BetaBinding, isKvConfigured } from "@/lib/betaBinding";

export async function POST(request: Request) {
  if (!isKvConfigured()) {
    return NextResponse.json({ ok: false, reason: "kv_not_configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    const emailHash = typeof body?.emailHash === "string" ? body.emailHash.trim() : "";
    const validation = isCodeValid(code);
    if (!validation.ok) return NextResponse.json(validation, { status: 400 });
    if (!emailHash) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });

    const binding = await kv.get<BetaBinding>(betaBindingKey(code));
    if (!binding) return NextResponse.json({ ok: false, reason: "not_activated" }, { status: 403 });
    if (!binding.hash || binding.hash !== emailHash) {
      return NextResponse.json({ ok: false, reason: "bound_to_other_email" }, { status: 403 });
    }

    return NextResponse.json({ ok: true, label: binding.label ?? validation.label, emailHash }, { status: 200 });
  } catch (err) {
    console.error("Failed to validate beta access", err);
    const status = err instanceof SyntaxError ? 400 : 500;
    return NextResponse.json({ ok: false, reason: status === 400 ? "invalid" : "server_error" }, { status });
  }
}
