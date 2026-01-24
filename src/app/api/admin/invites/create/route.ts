import { kv } from "@vercel/kv";
import { randomBytes } from "crypto";
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
const INVITE_INDEX_KEY = "beta:invite:index";

function generateCode() {
  const segment = () => randomBytes(2).toString("hex").slice(0, 4).toUpperCase();
  return `PLANTAO-${segment()}-${segment()}`;
}

function inviteKey(code: string) {
  return `${INVITE_PREFIX}${(code || "").trim().toLowerCase()}`;
}

async function addToIndex(code: string) {
  try {
    const existing = (await kv.get<string[]>(INVITE_INDEX_KEY)) ?? [];
    if (!existing.includes(code)) {
      await kv.set(INVITE_INDEX_KEY, [...existing, code]);
    }
  } catch (err) {
    console.error("Failed to update invite index", err);
  }
}

export async function POST(request: Request) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const rawLabel = typeof body?.label === "string" ? body.label.trim() : "";
    const daysValid = typeof body?.daysValid === "number" && body.daysValid > 0 ? body.daysValid : 0;
    if (!rawLabel || !daysValid) {
      return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
    }

    let code = generateCode();
    let attempts = 0;
    while (attempts < 5) {
      const exists = await kv.exists(inviteKey(code));
      if (!exists) break;
      code = generateCode();
      attempts += 1;
    }

    const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000).toISOString();
    const payload: InviteRecord = { label: rawLabel, expiresAt, revoked: false, createdAt: new Date().toISOString() };

    await kv.set(inviteKey(code), payload);
    await addToIndex(code);

    return NextResponse.json({ ok: true, code, label: rawLabel, expiresAt }, { status: 200 });
  } catch (err) {
    console.error("Failed to create invite", err);
    return NextResponse.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}
