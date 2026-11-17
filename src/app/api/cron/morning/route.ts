import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { runMorningJob } from "@/lib/morning-job";

// Vercel Cron calls this every morning (see vercel.json) with
// "Authorization: Bearer <CRON_SECRET>". Anyone else gets 401.

export const maxDuration = 60;

function authorised(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  }
  if (!authorised(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const report = await runMorningJob(createAdminClient());
    return Response.json(report);
  } catch (error) {
    console.error("Morning job failed", error);
    return Response.json({ error: "Morning job failed" }, { status: 500 });
  }
}
