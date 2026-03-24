export const BETA_SESSION_COOKIE_NAME = "beta_access_session_v1";

const BETA_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const BETA_REMEMBER_MAX_AGE_SECONDS = 24 * 60 * 60;

export type BetaSessionPayload = {
  code: string;
  emailHash: string;
  label?: string;
  remember?: boolean;
  exp: number;
};

function appEnv() {
  return (process.env.APP_ENV ?? process.env.ENVIRONMENT ?? "").trim().toLowerCase();
}

export function shouldUseSecureCookies() {
  const nodeEnv = (process.env.NODE_ENV ?? "").trim().toLowerCase();
  const vercelEnv = (process.env.VERCEL_ENV ?? "").trim().toLowerCase();
  const env = appEnv();
  return nodeEnv === "production" || vercelEnv === "production" || vercelEnv === "preview" || env === "production" || env === "staging" || env === "preview";
}

export function betaSessionMaxAgeSeconds(rememberDevice: boolean) {
  return rememberDevice ? BETA_REMEMBER_MAX_AGE_SECONDS : BETA_SESSION_MAX_AGE_SECONDS;
}

export function encodeBetaSession(payload: Omit<BetaSessionPayload, "exp">) {
  const exp = Date.now() + betaSessionMaxAgeSeconds(Boolean(payload.remember)) * 1000;
  const value: BetaSessionPayload = { ...payload, exp };
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeBetaSession(token: string) {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as BetaSessionPayload;
    if (!parsed?.code || !parsed?.emailHash || !parsed?.exp) return null;
    if (Number(parsed.exp) <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return "";
  const parts = cookieHeader.split(";").map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${name}=`));
  if (!match) return "";
  return decodeURIComponent(match.slice(name.length + 1));
}

export function readBetaSessionFromCookie(cookieHeader: string | null) {
  const raw = readCookieValue(cookieHeader, BETA_SESSION_COOKIE_NAME);
  if (!raw) return null;
  return decodeBetaSession(raw);
}

export function clearBetaSessionCookie(response: { cookies: { set: (name: string, value: string, opts: Record<string, unknown>) => void } }) {
  response.cookies.set(BETA_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    path: "/",
    maxAge: 0
  });
}

export function setBetaSessionCookie(
  response: { cookies: { set: (name: string, value: string, opts: Record<string, unknown>) => void } },
  payload: Omit<BetaSessionPayload, "exp">
) {
  response.cookies.set(BETA_SESSION_COOKIE_NAME, encodeBetaSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    path: "/",
    maxAge: betaSessionMaxAgeSeconds(Boolean(payload.remember))
  });
}
