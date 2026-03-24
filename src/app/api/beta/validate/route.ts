import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { isCodeValid } from "../../../../beta/access";
import { betaBindingKey, BetaBinding, isKvConfigured, shouldBypassBetaAuthWhenKvUnavailable } from "../../../../lib/betaBinding";
import { clearBetaSessionCookie, readBetaSessionFromCookie, setBetaSessionCookie } from "../../../../lib/betaSession";
import { rateLimit } from "../../../../lib/rateLimit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const kvConfigured = isKvConfigured();
  if (!kvConfigured && !shouldBypassBetaAuthWhenKvUnavailable()) {
    return NextResponse.json({ ok: false, reason: "kv_not_configured" }, { status: 500 });
  }
  if (!kvConfigured && shouldBypassBetaAuthWhenKvUnavailable()) {
    const session = readBetaSessionFromCookie(request.headers.get("cookie"));
    const code = session?.code || "dev_bypass";
    const emailHash = session?.emailHash || "dev_bypass";
    const remember = Boolean(session?.remember);
    const response = NextResponse.json({ ok: true, label: "dev_bypass", code }, { status: 200 });
    setBetaSessionCookie(response, { code, emailHash, label: "dev_bypass", remember });
    return response;
  }

  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rl = await rateLimit(`rl:validate:${ip}`, 10, 60);
    if (!rl.allowed) {
      return NextResponse.json({ ok: false, reason: "rate_limited" }, { status: 429 });
    }

    const session = readBetaSessionFromCookie(request.headers.get("cookie"));
    if (session?.code && session?.emailHash) {
      const validation = await isCodeValid(session.code);
      if (validation.ok) {
        const binding = await kv.get<BetaBinding>(betaBindingKey(session.code));
        if (binding?.hash && binding.hash === session.emailHash) {
          const label = binding.label ?? validation.label;
          const response = NextResponse.json({ ok: true, label, emailHash: session.emailHash, code: session.code }, { status: 200 });
          setBetaSessionCookie(response, { code: session.code, emailHash: session.emailHash, label, remember: Boolean(session.remember) });
          return response;
        }
      }
    }

    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const code = typeof (body as { code?: string })?.code === "string" ? (body as { code: string }).code.trim() : "";
    const emailHash = typeof (body as { emailHash?: string })?.emailHash === "string" ? (body as { emailHash: string }).emailHash.trim() : "";
    if (!code || !emailHash) {
      const response = NextResponse.json({ ok: false, reason: "not_activated" }, { status: 403 });
      clearBetaSessionCookie(response);
      return response;
    }

    const validation = await isCodeValid(code);
    if (!validation.ok) {
      const response = NextResponse.json(validation, { status: 400 });
      clearBetaSessionCookie(response);
      return response;
    }

    const binding = await kv.get<BetaBinding>(betaBindingKey(code));
    if (!binding) {
      const response = NextResponse.json({ ok: false, reason: "not_activated" }, { status: 403 });
      clearBetaSessionCookie(response);
      return response;
    }
    if (!binding.hash || binding.hash !== emailHash) {
      const response = NextResponse.json({ ok: false, reason: "bound_to_other_email" }, { status: 403 });
      clearBetaSessionCookie(response);
      return response;
    }

    const label = binding.label ?? validation.label;
    const response = NextResponse.json({ ok: true, label, emailHash, code }, { status: 200 });
    setBetaSessionCookie(response, { code, emailHash, label, remember: false });
    return response;
  } catch (err) {
    console.error("Failed to validate beta access", err);
    const status = err instanceof SyntaxError ? 400 : 500;
    return NextResponse.json({ ok: false, reason: status === 400 ? "invalid" : "server_error" }, { status });
  }
}
