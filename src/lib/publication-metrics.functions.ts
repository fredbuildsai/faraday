import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { threeYearsAgo } from "@/lib/opportunities";
import { openAccessPercentage } from "@/lib/publication-metrics";

export const getPublicationMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ authorIds: z.array(z.string().regex(/^A\d+$/)).min(1).max(10) }).parse(data))
  .handler(async ({ data }) => {
    const { openalexGet } = await import("@/lib/openalex.server");
    const since = threeYearsAgo(new Date());
    const filter = `author.id:${[...new Set(data.authorIds)].join("|")},from_publication_date:${since}`;
    try {
      const [all, oa] = await Promise.all([
        openalexGet<{ meta: { count: number } }>(`/works?filter=${filter}&per_page=1&select=id`),
        openalexGet<{ meta: { count: number } }>(`/works?filter=${filter},is_oa:true&per_page=1&select=id`),
      ]);
      const total = all.meta?.count ?? null;
      const open = oa.meta?.count ?? null;
      return { total, open, percentage: openAccessPercentage(total, open), since };
    } catch {
      return { total: null, open: null, percentage: null, since };
    }
  });