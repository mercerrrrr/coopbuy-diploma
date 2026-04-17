import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { autoCloseExpiredProcurements } from "@/lib/procurements/autoCloseExpired";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    logger.error({ route: "cron/auto-close" }, "CRON_SECRET is not set");
    return NextResponse.json({ error: "cron_not_configured" }, { status: 500 });
  }

  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const closed = await autoCloseExpiredProcurements(prisma);
    logger.info({ route: "cron/auto-close", closed }, "auto-close completed");
    return NextResponse.json({ ok: true, closed });
  } catch (err) {
    logger.error({ err, route: "cron/auto-close" }, "auto-close failed");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
