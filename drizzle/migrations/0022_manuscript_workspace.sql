ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS custom_roles jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE public.project_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('aim','question')),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
  body text NOT NULL DEFAULT '' CHECK (length(body) <= 5000),
  resolved boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.project_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  openalex_id text,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 500),
  authors text NOT NULL DEFAULT '',
  year int,
  venue text NOT NULL DEFAULT '',
  doi text NOT NULL DEFAULT '',
  url text,
  added_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX project_references_openalex ON public.project_references (project_id, openalex_id) WHERE openalex_id IS NOT NULL;
CREATE TABLE public.project_contributions (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (length(role) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id, role)
);
ALTER TABLE public.project_comments ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.project_items(id) ON DELETE CASCADE;
ALTER TABLE public.project_comments ADD COLUMN IF NOT EXISTS reference_id uuid REFERENCES public.project_references(id) ON DELETE CASCADE;
ALTER TABLE public.project_comments ADD COLUMN IF NOT EXISTS mentions uuid[] NOT NULL DEFAULT '{}';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_items TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.project_references TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.project_contributions TO authenticated;
GRANT ALL ON public.project_items, public.project_references, public.project_contributions TO service_role;
ALTER TABLE public.project_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read items" ON public.project_items FOR SELECT TO authenticated USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "members add items" ON public.project_items FOR INSERT TO authenticated WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "members update items" ON public.project_items FOR UPDATE TO authenticated USING (public.is_project_member(project_id, auth.uid())) WITH CHECK (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "members delete items" ON public.project_items FOR DELETE TO authenticated USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "members read references" ON public.project_references FOR SELECT TO authenticated USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "members add references" ON public.project_references FOR INSERT TO authenticated WITH CHECK (public.is_project_member(project_id, auth.uid()) AND added_by = auth.uid());
CREATE POLICY "members delete references" ON public.project_references FOR DELETE TO authenticated USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "members read contributions" ON public.project_contributions FOR SELECT TO authenticated USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "members assign contributions" ON public.project_contributions FOR INSERT TO authenticated WITH CHECK (public.is_project_member(project_id, auth.uid()) AND public.is_project_member(project_id, user_id));
CREATE POLICY "members unassign contributions" ON public.project_contributions FOR DELETE TO authenticated USING (public.is_project_member(project_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.trg_project_extra() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid := auth.uid(); pid uuid := coalesce(NEW.project_id, OLD.project_id);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = pid) THEN RETURN coalesce(NEW, OLD); END IF;
  IF TG_TABLE_NAME = 'project_items' THEN
    IF TG_OP = 'INSERT' THEN PERFORM public.log_project(pid, coalesce(actor, NEW.created_by), 'item_added', jsonb_build_object('kind', NEW.kind, 'title', NEW.title), NULL);
    ELSIF TG_OP = 'UPDATE' AND NEW.resolved <> OLD.resolved THEN PERFORM public.log_project(pid, actor, CASE WHEN NEW.resolved THEN 'item_resolved' ELSE 'item_reopened' END, jsonb_build_object('kind', NEW.kind, 'title', NEW.title), NULL);
    ELSIF TG_OP = 'DELETE' THEN PERFORM public.log_project(pid, actor, 'item_removed', jsonb_build_object('kind', OLD.kind, 'title', OLD.title), NULL);
    END IF;
  ELSIF TG_TABLE_NAME = 'project_references' THEN
    IF TG_OP = 'INSERT' THEN PERFORM public.log_project(pid, coalesce(actor, NEW.added_by), 'reference_added', jsonb_build_object('title', NEW.title), NULL);
    ELSIF TG_OP = 'DELETE' THEN PERFORM public.log_project(pid, actor, 'reference_removed', jsonb_build_object('title', OLD.title), NULL);
    END IF;
  ELSIF TG_TABLE_NAME = 'project_contributions' THEN
    IF TG_OP = 'INSERT' THEN PERFORM public.log_project(pid, actor, 'contribution_added', jsonb_build_object('name', public.actor_name(NEW.user_id), 'role', NEW.role), NULL);
    ELSIF TG_OP = 'DELETE' THEN PERFORM public.log_project(pid, actor, 'contribution_removed', jsonb_build_object('name', public.actor_name(OLD.user_id), 'role', OLD.role), NULL);
    END IF;
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
REVOKE EXECUTE ON FUNCTION public.trg_project_extra() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER project_items_activity AFTER INSERT OR UPDATE OR DELETE ON public.project_items FOR EACH ROW EXECUTE FUNCTION public.trg_project_extra();
CREATE TRIGGER project_references_activity AFTER INSERT OR DELETE ON public.project_references FOR EACH ROW EXECUTE FUNCTION public.trg_project_extra();
CREATE TRIGGER project_contributions_activity AFTER INSERT OR DELETE ON public.project_contributions FOR EACH ROW EXECUTE FUNCTION public.trg_project_extra();

-- Mentioned members (accepted only, never the author) get a notification.
CREATE OR REPLACE FUNCTION public.trg_comment_mentions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t text;
BEGIN
  IF coalesce(array_length(NEW.mentions, 1), 0) = 0 THEN RETURN NEW; END IF;
  SELECT title INTO t FROM public.projects WHERE id = NEW.project_id;
  INSERT INTO public.notifications (user_id, project_id, kind, body)
  SELECT m.user_id, NEW.project_id, 'mention', public.actor_name(NEW.author_id) || ' mentioned you in "' || t || '": ' || left(NEW.body, 120)
  FROM public.project_members m
  WHERE m.project_id = NEW.project_id AND m.state = 'accepted' AND m.user_id = ANY(NEW.mentions) AND m.user_id <> NEW.author_id;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.trg_comment_mentions() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER project_comments_mentions AFTER INSERT ON public.project_comments FOR EACH ROW EXECUTE FUNCTION public.trg_comment_mentions();

-- Existing opportunities get the manuscript sections after their earlier ones.
INSERT INTO public.project_sections (project_id, key, title, position)
SELECT p.id, s.key, s.title, s.pos FROM public.projects p
CROSS JOIN (VALUES ('abstract','Abstract',10),('introduction','Introduction',11),('experimental','Experimental',12),('results','Results and discussion',13),('conclusions','Conclusions',14)) AS s(key, title, pos)
ON CONFLICT (project_id, key) DO NOTHING;