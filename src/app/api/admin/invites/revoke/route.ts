import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/adminAuth";

export const runtime = "nodejs";

type InviteRecord = {
  label: string;
  expiresAt: string;
  revoked: boolean;
  createdAt: string;
};

const INVITE_PREFIX = "beta:invite:";

function inviteKey(code: string) {
  return `${INVITE_PREFIX}${(code || "").trim().toLowerCase()}`;
}

export async function POST(request: Request) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    if (!code) {
      return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
    }

    const key = inviteKey(code);
    const existing = await kv.get<InviteRecord>(key);
    if (!existing) {
      return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
    }

    await kv.set(key, { ...existing, revoked: true });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("Failed to revoke invite", err);
    return NextResponse.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}
