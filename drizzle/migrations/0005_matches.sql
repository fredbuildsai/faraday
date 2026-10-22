CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score double precision NOT NULL,
  t double precision NOT NULL, m double precision NOT NULL, act double precision NOT NULL,
  shared_topics text[] NOT NULL DEFAULT '{}',
  a_only text[] NOT NULL DEFAULT '{}',
  b_only text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);
GRANT SELECT ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read matches" ON public.matches FOR SELECT TO authenticated USING (auth.uid() IN (user_a, user_b));

CREATE TABLE public.interests (
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.interests TO authenticated;
GRANT ALL ON public.interests TO service_role;
ALTER TABLE public.interests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own interest read" ON public.interests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own interest add" ON public.interests FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND auth.uid() IN (m.user_a, m.user_b)));
CREATE POLICY "own interest remove" ON public.interests FOR DELETE TO authenticated USING (
  user_id = auth.uid() AND NOT EXISTS (SELECT 1 FROM public.interests o WHERE o.match_id = interests.match_id AND o.user_id <> auth.uid()));

CREATE OR REPLACE FUNCTION public.my_matches()
RETURNS TABLE (id uuid, other_id uuid, other_name text, other_institution text, score double precision,
  t double precision, m double precision, act double precision, shared_topics text[], you_bring text[], they_bring text[],
  created_at timestamptz, i_am_interested boolean, they_are_interested boolean, other_email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT mt.id, o.id,
    trim(coalesce(o.first_name,'') || ' ' || coalesce(o.last_name,'')), o.institution,
    mt.score, mt.t, mt.m, mt.act, mt.shared_topics,
    CASE WHEN mt.user_a = auth.uid() THEN mt.a_only ELSE mt.b_only END,
    CASE WHEN mt.user_a = auth.uid() THEN mt.b_only ELSE mt.a_only END,
    mt.created_at, mi.user_id IS NOT NULL, oi.user_id IS NOT NULL,
    CASE WHEN mi.user_id IS NOT NULL AND oi.user_id IS NOT NULL THEN (SELECT u.email::text FROM auth.users u WHERE u.id = o.id) END
  FROM public.matches mt
  JOIN public.profiles o ON o.id = CASE WHEN mt.user_a = auth.uid() THEN mt.user_b ELSE mt.user_a END
  LEFT JOIN public.interests mi ON mi.match_id = mt.id AND mi.user_id = auth.uid()
  LEFT JOIN public.interests oi ON oi.match_id = mt.id AND oi.user_id = o.id
  WHERE auth.uid() IN (mt.user_a, mt.user_b)
  ORDER BY mt.score DESC
$$;
REVOKE ALL ON FUNCTION public.my_matches() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_matches() TO authenticated;