import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "cb_session";

function getSecret() {
  const s = process.env.AUTH_SECRET || "dev-secret-please-change-in-production";
  return new TextEncoder().encode(s);
}

async function getPayload(request) {
  const token = request.cookies.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload;
  } catch {
    return null;
  }
}

function loginRedirect(request) {
  const url = request.nextUrl.clone();
  const next = request.nextUrl.pathname;
  url.pathname = "/auth/login";
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

function forbiddenRedirect(request) {
  const url = request.nextUrl.clone();
  url.pathname = "/403";
  url.search = "";
  return NextResponse.redirect(url);
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // /p/* — requires any authenticated session
  if (pathname.startsWith("/p/")) {
    const payload = await getPayload(request);
    if (!payload) return loginRedirect(request);
    return NextResponse.next();
  }

  // /my/* — any authenticated user
  if (pathname.startsWith("/my/")) {
    const payload = await getPayload(request);
    if (!payload) return loginRedirect(request);
    return NextResponse.next();
  }

  // /admin/* — requires ADMIN or OPERATOR
  if (pathname.startsWith("/admin/")) {
    const payload = await getPayload(request);
    if (!payload) return loginRedirect(request);

    const role = payload.role;

    // /admin/locations, /admin/suppliers, /admin/dictionaries — ADMIN only
    if (
      pathname.startsWith("/admin/locations") ||
      pathname.startsWith("/admin/suppliers") ||
      pathname.startsWith("/admin/dictionaries")
    ) {
      if (role !== "ADMIN") return forbiddenRedirect(request);
    }

    // /admin/procurements — ADMIN or OPERATOR
    // generic /admin/* catch-all — ADMIN or OPERATOR
    if (role !== "ADMIN" && role !== "OPERATOR") return forbiddenRedirect(request);

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/my/:path*", "/p/:path*"],
};
