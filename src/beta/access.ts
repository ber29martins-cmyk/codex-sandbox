export type BetaCode = {
  code: string;
  label: string;
  expiresAt: string; // ISO
  revoked?: boolean;
};

const now = new Date();
const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

export const BETA_CODES: BetaCode[] = [
  {
    code: "PLANTAO-OWNER-2027",
    label: "Owner",
    expiresAt: "2027-12-31T23:59:59Z"
  },
  {
    code: "PLANTAO-BETA-2026",
    label: "Convite beta",
    expiresAt: in14Days
  },
  {
    code: "PLANTAO-TEST-2024",
    label: "Expirado",
    expiresAt: "2024-12-31T23:59:59Z"
  },
  {
    code: "PLANTAO-REVOG-2026",
    label: "Revogado",
    expiresAt: "2026-12-31T23:59:59Z",
    revoked: true
  }
];

export function isCodeValid(inputCode: string, now = new Date()): { ok: true; label: string } | { ok: false; reason: string } {
  const code = (inputCode || "").trim();
  if (!code) return { ok: false, reason: "invalid" };

  const match = BETA_CODES.find((c) => c.code.toLowerCase() === code.toLowerCase());
  if (!match) return { ok: false, reason: "invalid" };
  if (match.revoked) return { ok: false, reason: "revoked" };

  const expires = new Date(match.expiresAt);
  if (Number.isNaN(expires.getTime()) || now >= expires) return { ok: false, reason: "expired" };

  return { ok: true, label: match.label };
}
