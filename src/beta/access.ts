import { kv } from "@vercel/kv";

export type BetaCode = {
  code: string;
  label: string;
  expiresAt: string; // ISO
  revoked?: boolean;
};

export type InviteRecord = {
  label: string;
  expiresAt: string;
  revoked?: boolean;
  createdAt: string;
};

export const BETA_CODES: BetaCode[] = [
  {
    code: "PLANTAO-OWNER-2027",
    label: "Owner",
    expiresAt: "2027-12-31T23:59:59Z"
  }
];

const INVITE_PREFIX = "beta:invite:";

function inviteKey(code: string) {
  return `${INVITE_PREFIX}${(code || "").trim().toLowerCase()}`;
}

export async function isCodeValid(
  inputCode: string,
  now = new Date()
): Promise<{ ok: true; label: string } | { ok: false; reason: string }> {
  const code = (inputCode || "").trim();
  if (!code) return { ok: false, reason: "invalid" };

  const match = BETA_CODES.find((c) => c.code.toLowerCase() === code.toLowerCase());
  if (match) {
    if (match.revoked) return { ok: false, reason: "revoked" };
    const expires = new Date(match.expiresAt);
    if (Number.isNaN(expires.getTime()) || now >= expires) return { ok: false, reason: "expired" };
    return { ok: true, label: match.label };
  }

  try {
    const invite = await kv.get<InviteRecord>(inviteKey(code));
    if (!invite) return { ok: false, reason: "invalid" };
    if (invite.revoked) return { ok: false, reason: "revoked" };
    const expires = new Date(invite.expiresAt);
    if (Number.isNaN(expires.getTime()) || now >= expires) return { ok: false, reason: "expired" };
    return { ok: true, label: invite.label };
  } catch (err) {
    console.error("Failed to validate invite from KV", err);
    return { ok: false, reason: "server_error" };
  }
}
