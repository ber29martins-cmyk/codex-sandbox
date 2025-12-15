export const INVITE_CODES = (process.env.NEXT_PUBLIC_INVITE_CODES ?? "")
  .split(",")
  .map((code) => code.trim().toLowerCase())
  .filter(Boolean);

export function isInviteValid(code: string | null | undefined) {
  if (!code) return false;
  return INVITE_CODES.includes(code.trim().toLowerCase());
}
