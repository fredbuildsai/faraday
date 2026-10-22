ALTER TABLE public.external_suggestions ADD COLUMN IF NOT EXISTS recent_works int;
DROP FUNCTION IF EXISTS public.match_cards();
CREATE FUNCTION public.match_cards()
 RETURNS TABLE(other_id uuid, h_index int, citations bigint, works_count int, recent_works int, interests text, methods text[], directions text[], openalex_ids text[])
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH others AS (
    SELECT DISTINCT CASE WHEN mt.user_a = auth.uid() THEN mt.user_b ELSE mt.user_a END AS oid
    FROM public.matches mt WHERE auth.uid() IN (mt.user_a, mt.user_b)
  ), ranked AS (
    SELECT w.user_id, w.cited_by_count, w.year,
      row_number() OVER (PARTITION BY w.user_id ORDER BY w.cited_by_count DESC) AS rn
    FROM public.works w JOIN others o ON o.oid = w.user_id
  )
  SELECT o.oid,
    coalesce((SELECT count(*)::int FROM ranked r WHERE r.user_id = o.oid AND r.cited_by_count >= r.rn), 0),
    coalesce((SELECT sum(r.cited_by_count) FROM ranked r WHERE r.user_id = o.oid), 0),
    coalesce((SELECT count(*)::int FROM ranked r WHERE r.user_id = o.oid), 0),
    coalesce((SELECT count(*)::int FROM ranked r WHERE r.user_id = o.oid AND r.year >= extract(year FROM now())::int - 3), 0),
    p.research_interests,
    coalesce((SELECT array_agg(coalesce(e->>'label', e->>'name', e#>>'{}')) FROM jsonb_array_elements(pa.methods) e), '{}'),
    coalesce((SELECT array_agg(coalesce(e->>'label', e->>'name', e#>>'{}')) FROM jsonb_array_elements(pa.directions) e), '{}'),
    coalesce(p.openalex_author_ids, '{}')
  FROM others o
  JOIN public.profiles p ON p.id = o.oid
  LEFT JOIN public.profile_analysis pa ON pa.user_id = o.oid AND pa.status = 'done'
$function$;
REVOKE ALL ON FUNCTION public.match_cards() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.match_cards() TO authenticated;