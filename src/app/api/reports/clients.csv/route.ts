import { buildReport, clientsCsv, PERIODS } from "@/lib/reports";
import { getCurrentUser } from "@/lib/session";

/**
 * The per-client summary as a CSV download.
 *
 * Admin only, and checked here rather than relying on the link being hidden.
 * This is a business summary of every grower — spend, yield, sale value — so it
 * must not be reachable by anyone who happens to guess the path. A grower gets
 * the same 404 as a stranger.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const requested = url.searchParams.get("period") ?? "12m";
  const period = PERIODS.some((p) => p.key === requested) ? requested : "12m";

  const report = await buildReport(period);

  // Excel on Windows is where this is going, and it reads a CSV as UTF-8 only
  // when the file says so. Without the byte-order mark every rupee sign in the
  // file arrives mangled.
  const csv = "﻿" + clientsCsv(report.clients);

  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="aela-clients-${period}-${stamp}.csv"`,
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
    },
  });
}
