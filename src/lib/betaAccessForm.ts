export function getBetaAccessValidationError(code: string, email: string): "invalid" | "invalid_email" | null {
  if (!code.trim()) return "invalid";
  if (!email.trim()) return "invalid_email";
  return null;
}
