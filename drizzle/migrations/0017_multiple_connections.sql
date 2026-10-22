-- Common connections become a list: several shared co-authors can be stored per match.
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS vias text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.external_suggestions ADD COLUMN IF NOT EXISTS vias text[] NOT NULL DEFAULT '{}';
UPDATE public.matches SET vias = ARRAY[via] WHERE via IS NOT NULL AND vias = '{}';
UPDATE public.external_suggestions SET vias = ARRAY[via] WHERE via IS NOT NULL AND vias = '{}';
COMMENT ON COLUMN public.matches.via IS 'DEPRECATED: replaced by vias (list of shared co-authors)';
COMMENT ON COLUMN public.external_suggestions.via IS 'DEPRECATED: replaced by vias (list of shared co-authors)';