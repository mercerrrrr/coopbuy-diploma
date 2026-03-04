import { headers } from "next/headers";

/**
 * Returns the base URL of the app (no trailing slash).
 * Priority: NEXT_PUBLIC_APP_URL env var → x-forwarded-proto/host headers → http://localhost:3000
 */
export async function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
