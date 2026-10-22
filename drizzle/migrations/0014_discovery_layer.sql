ALTER TABLE public.works ADD COLUMN IF NOT EXISTS authors jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS layer text NOT NULL DEFAULT 'interest';
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS via text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_unique_pair ON public.matches (LEAST(user_a, user_b), GREATEST(user_a, user_b));
CREATE INDEX IF NOT EXISTS idx_matches_user_a ON public.matches (user_a);
CREATE INDEX IF NOT EXISTS idx_matches_user_b ON public.matches (user_b);