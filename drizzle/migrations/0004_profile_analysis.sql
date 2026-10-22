CREATE TABLE public.profile_analysis (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed')),
  summary text,
  interests jsonb NOT NULL DEFAULT '[]',
  methods jsonb NOT NULL DEFAULT '[]',
  directions jsonb NOT NULL DEFAULT '[]',
  dropped_claims jsonb NOT NULL DEFAULT '[]',
  input_hash text,
  error text,
  finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT (user_id, status, summary, interests, methods, directions, error, finished_at, updated_at) ON public.profile_analysis TO authenticated;
GRANT ALL ON public.profile_analysis TO service_role;
ALTER TABLE public.profile_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own analysis" ON public.profile_analysis FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX analysis_runs_user_time ON public.analysis_runs(user_id, created_at);
GRANT ALL ON public.analysis_runs TO service_role;
ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profile_analysis_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('interest','method')),
  value text NOT NULL CHECK (char_length(value) BETWEEN 1 AND 120),
  action text NOT NULL CHECK (action IN ('add','remove')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, value)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_analysis_edits TO authenticated;
GRANT ALL ON public.profile_analysis_edits TO service_role;
ALTER TABLE public.profile_analysis_edits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own edits" ON public.profile_analysis_edits FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);