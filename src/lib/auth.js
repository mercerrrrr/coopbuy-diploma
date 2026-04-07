import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

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
 * Returns null if cookie missing or token invalid.
 * Use in Server Components / Server Actions (Node.js context).
 */
export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/**
 * Set the cb_session cookie with a signed JWT.
 * Call from Server Actions after successful login/register.
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
