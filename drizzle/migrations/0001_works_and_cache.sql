CREATE TABLE public.works (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  openalex_id text NOT NULL,
  doi text,
  title text NOT NULL,
  year int,
  type text,
  cited_by_count int NOT NULL DEFAULT 0,
  topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  venue text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, openalex_id)
);
CREATE INDEX works_user_idx ON public.works(user_id);
GRANT SELECT ON public.works TO authenticated;
GRANT ALL ON public.works TO service_role;
ALTER TABLE public.works ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own works read" ON public.works FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.openalex_cache (
  url text PRIMARY KEY,
  body jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.openalex_cache TO service_role;
ALTER TABLE public.openalex_cache ENABLE ROW LEVEL SECURITY;