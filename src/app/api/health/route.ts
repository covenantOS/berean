import { NextResponse } from "next/server";

/**
 * Liveness for the host's health checks. Deliberately imports nothing from
 * the data shelf: this must answer even while the shelf is cold-loading
 * hundreds of megabytes into memory, or the host would kill a healthy
 * container during warm-up.
 */
export function GET() {
  return NextResponse.json({ ok: true });
}
