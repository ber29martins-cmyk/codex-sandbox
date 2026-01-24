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
const INVITE_INDEX_KEY = "beta:invite:index";

function inviteKey(code: string) {
  return `${INVITE_PREFIX}${(code || "").trim().toLowerCase()}`;
}

async function listKeys(): Promise<string[]> {
  const client = kv as any;
  try {
    if (typeof client.scanIterator === "function") {
      const keys: string[] = [];
      for await (const key of client.scanIterator({ prefix: INVITE_PREFIX })) {
        keys.push(String(key));
      }
      if (keys.length) return keys;
    } else if (typeof client.scan === "function") {
      let cursor = 0;
      const keys: string[] = [];
      do {
        const res = await client.scan(cursor, { match: `${INVITE_PREFIX}*`, count: 100 });
        cursor = Array.isArray(res) ? res[0] : 0;
        const batch = Array.isArray(res) ? res[1] : [];
        if (Array.isArray(batch)) keys.push(...batch);
      } while (cursor !== 0);
      if (keys.length) return keys;
    }
  } catch (err) {
    console.error("Invite scan failed, falling back to index", err);
  }

  const idx = await kv.get<string[]>(INVITE_INDEX_KEY);
  return (idx ?? []).map((c) => inviteKey(c));
}

export async function GET(request: Request) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  try {
    const keys = await listKeys();
    const invites = (
      await Promise.all(
        keys.map(async (key) => {
          const data = await kv.get<InviteRecord>(key);
          if (!data) return null;
          return {
            code: key.slice(INVITE_PREFIX.length).toUpperCase(),
            ...data
          };
        })
      )
    )
      .filter(Boolean)
      .sort((a, b) => (a!.createdAt > b!.createdAt ? -1 : 1));

    return NextResponse.json({ ok: true, invites }, { status: 200 });
  } catch (err) {
    console.error("Failed to list invites", err);
    return NextResponse.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}
