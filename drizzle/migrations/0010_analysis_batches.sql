CREATE TABLE public.analysis_batches (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  batch_key text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, batch_key)
);
GRANT SELECT ON public.analysis_batches TO authenticated;
GRANT ALL ON public.analysis_batches TO service_role;
ALTER TABLE public.analysis_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own batches readable" ON public.analysis_batches FOR SELECT TO authenticated USING (auth.uid() = user_id);