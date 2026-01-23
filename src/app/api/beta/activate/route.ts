import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { isCodeValid } from "@/beta/access";
import { betaBindingKey, BetaBinding, hashEmail, isEmailValid, isKvConfigured, normalizeEmail } from "@/lib/betaBinding";

export async function POST(request: Request) {
  if (!isKvConfigured()) {
    return NextResponse.json({ ok: false, reason: "kv_not_configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    const rawEmail = typeof body?.email === "string" ? body.email : "";
    const email = normalizeEmail(rawEmail);
    const validation = isCodeValid(code);
    if (!validation.ok) return NextResponse.json(validation, { status: 400 });
    if (!isEmailValid(email)) return NextResponse.json({ ok: false, reason: "invalid_email" }, { status: 400 });

    const emailHash = hashEmail(email);
    const key = betaBindingKey(code);
    const existing = await kv.get<BetaBinding>(key);
    if (!existing) {
      const payload: BetaBinding = { hash: emailHash, activatedAt: new Date().toISOString(), label: validation.label };
      await kv.set(key, payload);
      return NextResponse.json({ ok: true, label: validation.label, emailHash }, { status: 200 });
    }

    if (existing.hash !== emailHash) {
      return NextResponse.json({ ok: false, reason: "bound_to_other_email" }, { status: 403 });
    }

    return NextResponse.json({ ok: true, label: existing.label ?? validation.label, emailHash }, { status: 200 });
  } catch (err) {
    console.error("Failed to activate beta access", err);
    const status = err instanceof SyntaxError ? 400 : 500;
    return NextResponse.json({ ok: false, reason: status === 400 ? "invalid" : "server_error" }, { status });
  }
}
