export type BetaCode = {
  code: string;
  label: string;
  expiresAt: string; // ISO
  revoked?: boolean;
};

export const BETA_CODES: BetaCode[] = [
  {
    code: "PLANTAO-OWNER-2025",
    label: "Owner",
    expiresAt: "2025-12-31T23:59:59Z"
  },
  {
    code: "PLANTAO-BETA-2024",
    label: "Convite beta",
    expiresAt: "2025-02-28T23:59:59Z"
  },
  {
    code: "PLANTAO-TEST-2023",
    label: "Expirado",
    expiresAt: "2023-12-31T23:59:59Z"
  },
  {
    code: "PLANTAO-REVOG-2024",
    label: "Revogado",
    expiresAt: "2025-02-28T23:59:59Z",
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
