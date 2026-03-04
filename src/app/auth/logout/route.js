import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function GET(req) {
  await clearSessionCookie();
  const res = NextResponse.redirect(new URL("/", req.url));
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return res;
}
