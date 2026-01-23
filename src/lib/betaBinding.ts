import { createHash } from "crypto";

export type BetaBinding = {
  hash: string;
  activatedAt: string;
  label?: string;
};

export function isKvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export function normalizeEmail(input: string) {
  return (input || "").trim().toLowerCase();
}

export function isEmailValid(email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function hashEmail(email: string) {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

export function betaBindingKey(code: string) {
  return `beta:bind:${(code || "").trim().toLowerCase()}`;
}
