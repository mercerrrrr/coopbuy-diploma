import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/db";

const COOKIE = "cb_session";
const ALG = "HS256";
const TTL = "7d";

function getSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET environment variable is not set");
  return new TextEncoder().encode(s);
}

/** Sign a JWT session token */
export async function signSession(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(getSecret());
}

/** Verify a JWT token, return payload or null */
export async function verifySession(token) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload;
  } catch {
    return null;
  }
}

/**
 * Read cb_session cookie and return the session payload.
 * Returns null if cookie missing, JWT invalid, or tokenVersion mismatch
 * (token revoked via logout / forced logout).
 *
 * Trade-off: one SELECT per getSession() call. Memoized per-request via
 * React cache() so repeated calls within the same request hit DB once.
 */
export const getSession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySession(token);
  if (!payload?.sub) return null;

  const user = await prisma.user.findUnique({
    where: { id: String(payload.sub) },
    select: { tokenVersion: true },
  });
  if (!user) return null;
  if (payload.tv !== user.tokenVersion) return null;

  return payload;
});

/**
 * Set the cb_session cookie with a signed JWT.
 * Call from Server Actions after successful login/register.
 * Payload MUST include `tv` = user.tokenVersion for revocation to work.
 */
export async function setSessionCookie(payload) {
  const token = await signSession(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

/** Clear the session cookie. */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE);
}

/**
 * Invalidate all existing JWTs for a user by bumping their tokenVersion.
 * Returns the new tokenVersion. Any previously issued token with the old
 * tv will fail the getSession() check on its next request.
 */
export async function invalidateAllSessions(userId) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
    select: { tokenVersion: true },
  });
  return updated.tokenVersion;
}
