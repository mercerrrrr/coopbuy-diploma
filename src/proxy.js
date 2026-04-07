import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import {
  canAccessAdminPath,
  isAdminWorkspaceRole,
  isResidentRole,
} from "@/lib/constants";

const COOKIE = "cb_session";

function getSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET environment variable is not set");
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

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/my/")) {
    const payload = await getPayload(request);
    if (!payload) return loginRedirect(request);
    if (!isResidentRole(payload.role)) return forbiddenRedirect(request);
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin/")) {
    const payload = await getPayload(request);
    if (!payload) return loginRedirect(request);

    const role = payload.role;
    if (!isAdminWorkspaceRole(role)) return forbiddenRedirect(request);
    if (!canAccessAdminPath(pathname, role)) return forbiddenRedirect(request);

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/my/:path*"],
};
