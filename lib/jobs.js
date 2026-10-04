// In-memory registry of the admin's background jobs (re-capture, re-judge).
// Server only. Jobs run one at a time inside the Next server process, so a
// capture never competes with another for the browser; the admin polls
// GET /api/admin/jobs for their state. Nothing survives a server restart.
import { randomUUID } from "node:crypto";

const MAX_KEPT = 50;
const state = (globalThis.__jethroJobs ??= { jobs: [], running: false });

const view = (j) => ({
  id: j.id, kind: j.kind, siteId: j.siteId, domain: j.domain, status: j.status,
  error: j.error, result: j.result, queuedAt: j.queuedAt, startedAt: j.startedAt, finishedAt: j.finishedAt,
});

export function listJobs() {
  return state.jobs.map(view);
}

// A queued or running job for the site, if any.
export function activeJob(siteId) {
  return state.jobs.find((j) => j.siteId === siteId && (j.status === "queued" || j.status === "running"));
}

// Queues `run` (an async function) as a job and returns its view at once.
export function enqueue({ kind, siteId, domain }, run) {
  const job = { id: randomUUID(), kind, siteId, domain, status: "queued", error: null, result: null, queuedAt: new Date().toISOString(), run };
  state.jobs.unshift(job);
  const done = state.jobs.filter((j) => j.status === "done" || j.status === "failed");
  for (const old of done.slice(MAX_KEPT)) state.jobs.splice(state.jobs.indexOf(old), 1);
  drain();
  return view(job);
}

async function drain() {
  if (state.running) return;
  state.running = true;
  try {
    for (;;) {
      const job = state.jobs.findLast((j) => j.status === "queued");
      if (!job) return;
      job.status = "running";
      job.startedAt = new Date().toISOString();
      try {
        job.result = (await job.run()) ?? null;
        job.status = "done";
      } catch (err) {
        console.error(`[admin job ${job.kind} ${job.domain}]`, err);
        job.status = "failed";
        job.error = String(err.message || err).split("\n")[0].slice(0, 300);
      }
      job.finishedAt = new Date().toISOString();
      delete job.run;
    }
  } finally {
    state.running = false;
  }
}
