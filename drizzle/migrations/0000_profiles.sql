CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  institution text,
  orcid text,
  research_interests text CHECK (char_length(research_interests) <= 500),
  openalex_author_id text,
  topic_weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  activity numeric NOT NULL DEFAULT 0,
  works_truncated boolean NOT NULL DEFAULT false,
  last_imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  full_name text := coalesce(m->>'full_name', m->>'name', '');
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, institution, orcid)
  VALUES (
    NEW.id,
    coalesce(nullif(m->>'first_name',''), nullif(m->>'given_name',''), split_part(full_name, ' ', 1), ''),
    coalesce(nullif(m->>'last_name',''), nullif(m->>'family_name',''), nullif(substr(full_name, length(split_part(full_name,' ',1)) + 2), ''), ''),
    nullif(m->>'institution',''),
    nullif(m->>'orcid','')
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();