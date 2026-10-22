CREATE OR REPLACE FUNCTION public.trg_comment_mentions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t text;
BEGIN
  IF coalesce(array_length(NEW.mentions, 1), 0) = 0 THEN RETURN NEW; END IF;
  SELECT title INTO t FROM public.projects WHERE id = NEW.project_id;
  INSERT INTO public.notifications (user_id, project_id, kind, body)
  SELECT m.user_id, NEW.project_id, 'mention', public.actor_name(NEW.author_id) || ' mentioned you in "' || t || '": ' || left(NEW.body, 200)
  FROM public.project_members m
  WHERE m.project_id = NEW.project_id AND m.state IN ('invited','accepted') AND m.user_id = ANY(NEW.mentions) AND m.user_id <> NEW.author_id;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.trg_comment_mentions() FROM PUBLIC, anon, authenticated;