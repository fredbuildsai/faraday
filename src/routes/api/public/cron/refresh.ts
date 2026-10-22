import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { LOCK_MINUTES, REFRESH_AFTER_DAYS, USERS_PER_RUN, isLocalNight, pauseReasonFor } from "@/lib/refresh";

const JOB = "monthly_refresh";

/** Monthly refresh: re-import publications, re-run analysis if anything changed, then look for matches. */
export const Route = createFileRoute("/api/public/cron/refresh")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date();
        const { data: job } = await supabaseAdmin.from("job_state").select("*").eq("name", JOB).maybeSingle();
        if (job?.paused_reason) return Response.json({ skipped: "paused", reason: job.paused_reason });

        // Single-flight lease: only take it when free or expired.
        const until = new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString();
        const { data: got } = await supabaseAdmin.from("job_state").update({ locked_until: until })
          .eq("name", JOB).or(`locked_until.is.null,locked_until.lt.${now.toISOString()}`).select("name");
        if (!got?.length) return Response.json({ skipped: "locked" });

        const cutoff = new Date(now.getTime() - REFRESH_AFTER_DAYS * 86400_000).toISOString();
        const { data: candidates } = await supabaseAdmin.from("profiles").select("id, timezone")
          .not("last_imported_at", "is", null).lt("last_imported_at", cutoff)
          .order("last_imported_at", { ascending: true }).limit(500);
        // Runs hourly; only refresh people for whom it is currently night locally.
        const due = (candidates ?? []).filter((p) => isLocalNight(p.timezone, now)).slice(0, USERS_PER_RUN);

        const results: any[] = [];
        let pause: string | null = null;
        try {
          const { importWorksFor } = await import("@/lib/import-core.server");
          const { runAnalysisFor } = await import("@/lib/analysis-core.server");
          const { computeMatchesFor } = await import("@/lib/matching-core.server");
          for (const p of due) {
            const r: any = { user: p.id };
            try {
              // Import first: it stamps last_imported_at, so a re-run never redoes this user.
              r.import = await importWorksFor(p.id);
              const a: any = await runAnalysisFor(p.id); // skips itself when nothing changed
              r.analysis = a.status;
              pause = a.aiStatus ? pauseReasonFor(a.aiStatus) : null;
              if (pause) { results.push(r); break; }
              if (a.status === "done" || a.status === "skipped") r.matches = (await computeMatchesFor(p.id)).added;
            } catch (e) {
              console.error("refresh failed", p.id, e);
              r.error = e instanceof Error ? e.message : "failed";
            }
            results.push(r);
          }
        } finally {
          await supabaseAdmin.from("job_state").update({
            locked_until: null, last_run_at: now.toISOString(), last_result: results as any,
            ...(pause ? { paused_reason: pause, paused_at: now.toISOString() } : {}),
          }).eq("name", JOB);
        }
        return Response.json({ processed: results.length, paused: pause });
      },
    },
  },
});
