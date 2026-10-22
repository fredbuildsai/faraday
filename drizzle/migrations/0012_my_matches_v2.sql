DROP FUNCTION IF EXISTS public.my_matches();
CREATE FUNCTION public.my_matches()
 RETURNS TABLE(id uuid, other_id uuid, other_name text, other_institution text, score double precision, t double precision, m double precision, act double precision, shared_topics text[], you_bring text[], they_bring text[], created_at timestamp with time zone, i_am_interested boolean, they_are_interested boolean, other_email text, shared_methods text[], formula text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT mt.id, o.id,
    trim(coalesce(o.first_name,'') || ' ' || coalesce(o.last_name,'')), o.institution,
    mt.score, mt.t, mt.m, mt.act, mt.shared_topics,
    CASE WHEN mt.user_a = auth.uid() THEN mt.a_only ELSE mt.b_only END,
    CASE WHEN mt.user_a = auth.uid() THEN mt.b_only ELSE mt.a_only END,
    mt.created_at, mi.user_id IS NOT NULL, oi.user_id IS NOT NULL,
    CASE WHEN mi.user_id IS NOT NULL AND oi.user_id IS NOT NULL THEN (SELECT u.email::text FROM auth.users u WHERE u.id = o.id) END,
    mt.shared_methods, mt.formula
  FROM public.matches mt
  JOIN public.profiles o ON o.id = CASE WHEN mt.user_a = auth.uid() THEN mt.user_b ELSE mt.user_a END
  LEFT JOIN public.interests mi ON mi.match_id = mt.id AND mi.user_id = auth.uid()
  LEFT JOIN public.interests oi ON oi.match_id = mt.id AND oi.user_id = o.id
  WHERE auth.uid() IN (mt.user_a, mt.user_b)
  ORDER BY mt.score DESC
$function$;
REVOKE ALL ON FUNCTION public.my_matches() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_matches() TO authenticated;