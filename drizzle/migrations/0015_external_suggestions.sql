CREATE TABLE public.external_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  openalex_id text NOT NULL,
  name text NOT NULL,
  institution text,
  score double precision NOT NULL,
  t double precision NOT NULL,
  layer text NOT NULL DEFAULT 'interest',
  via text,
  shared_topics text[] NOT NULL DEFAULT '{}',
  h_index integer NOT NULL DEFAULT 0,
  citations bigint NOT NULL DEFAULT 0,
  works_count integer NOT NULL DEFAULT 0,
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','saved','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, openalex_id)
);
GRANT SELECT, UPDATE, DELETE ON public.external_suggestions TO authenticated;
GRANT ALL ON public.external_suggestions TO service_role;
ALTER TABLE public.external_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own external read" ON public.external_suggestions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own external update" ON public.external_suggestions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own external delete" ON public.external_suggestions FOR DELETE TO authenticated USING (auth.uid() = user_id);