import { kv } from "@vercel/kv";

export async function rateLimit(key: string, limit: number, windowSec: number) {
  const count = await kv.incr(key);
  if (count === 1) {
    await kv.expire(key, windowSec);
  }
  const allowed = count <= limit;
  const remaining = Math.max(0, limit - count);
  return { allowed, remaining };
}
