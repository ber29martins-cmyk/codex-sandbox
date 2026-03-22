import { createHash } from "crypto";

export type BetaBinding = {
  hash: string;
  activatedAt: string;
  label?: string;
};

export function isKvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export function isDevAuthBypassEnabled() {
  const rawFlag = (process.env.BETA_AUTH_DEV_BYPASS ?? "").trim().toLowerCase();
  const bypassRequested = rawFlag === "1" || rawFlag === "true";
  if (!bypassRequested) return false;

  const nodeEnv = (process.env.NODE_ENV ?? "").trim().toLowerCase();
  if (nodeEnv !== "development") return false;

  const vercelEnv = (process.env.VERCEL_ENV ?? "").trim().toLowerCase();
  const appEnv = (process.env.APP_ENV ?? process.env.ENVIRONMENT ?? "").trim().toLowerCase();
  const isProdOrStaging =
    vercelEnv === "production" ||
    vercelEnv === "preview" ||
    appEnv === "production" ||
    appEnv === "staging" ||
    appEnv === "preview";

  return !isProdOrStaging;
}

export function shouldBypassBetaAuthWhenKvUnavailable() {
  return !isKvConfigured() && isDevAuthBypassEnabled();
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
