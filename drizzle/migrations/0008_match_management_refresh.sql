CREATE TABLE public.match_user_state (
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','saved','dismissed')),
  notes text NOT NULL DEFAULT '',
  notes_updated_at timestamptz,
  summary text,
  ideas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ideas_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_user_state TO authenticated;
GRANT ALL ON public.match_user_state TO service_role;
ALTER TABLE public.match_user_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own match state read" ON public.match_user_state FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own match state insert" ON public.match_user_state FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND auth.uid() IN (m.user_a, m.user_b)));
CREATE POLICY "own match state update" ON public.match_user_state FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own match state delete" ON public.match_user_state FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.job_state (
  name text PRIMARY KEY,
  locked_until timestamptz,
  paused_reason text,
  paused_at timestamptz,
  last_run_at timestamptz,
  last_result jsonb
);
GRANT ALL ON public.job_state TO service_role;
ALTER TABLE public.job_state ENABLE ROW LEVEL SECURITY;
INSERT INTO public.job_state (name) VALUES ('monthly_refresh');