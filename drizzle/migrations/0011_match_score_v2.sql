ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS shared_methods text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS formula text NOT NULL DEFAULT 'c2';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS match_weights jsonb;
COMMENT ON COLUMN public.profiles.match_weights IS 'Optional per-user match weighting {topic, activity, minTopic, minScore}; null = app defaults';