import { queueCounts } from "../../../../lib/db";
import { runPipeline } from "../../../../pipeline/run";

export const dynamic = "force-dynamic";
// Pro plan ceiling. The run stops claiming at STOP_CLAIMING_MS so an in-flight
// site (home, judge, subpages, tags: several minutes on a function's CPU) can
// finish before the hard limit. A site cut off anyway is reset by a later run.
export const maxDuration = 800;
const STOP_CLAIMING_MS = 300 * 1000;

// Each run: refill the queue from discovery when it runs low, then take a few
// sites through capture → judge → subpages → tags, one at a time (a function
// has no GPU and little CPU, so a page takes about a minute). Fewer subpages
// than a local run keep an approved site within one run. The schedule in
// vercel.json sets how often it runs. Claims are atomic, so a run
// that overlaps another (or a local `npm run pipeline`) never doubles up.
const RUN = { limit: 4, concurrency: 1, maxJudge: 8, subpages: 4, discoverLimit: 30, retryFailed: true };
const LOW_QUEUE = 12;

// Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Not found", { status: 404 });
  }
  const queued = (await queueCounts()).capture;
  const totals = await runPipeline({ ...RUN, discover: queued < LOW_QUEUE }, { signal: AbortSignal.timeout(STOP_CLAIMING_MS) });
  return Response.json({ data: { queued, ...totals } }, { headers: { "Cache-Control": "no-store" } });
}
