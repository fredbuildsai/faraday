CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'idea' CHECK (status IN ('idea','drafting','submitted','funded','closed')),
  archived boolean NOT NULL DEFAULT false,
  source jsonb NOT NULL DEFAULT '{}'::jsonb,
  suggested_people jsonb NOT NULL DEFAULT '[]'::jsonb,
  whitespace jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.project_members (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'editor' CHECK (role IN ('owner','editor')),
  state text NOT NULL DEFAULT 'invited' CHECK (state IN ('invited','accepted','declined')),
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
CREATE TABLE public.project_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  openalex_id text NOT NULL,
  title text NOT NULL,
  url text,
  is_oa boolean NOT NULL DEFAULT false,
  origin text NOT NULL DEFAULT 'member',
  added_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, openalex_id)
);
CREATE TABLE public.project_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  key text NOT NULL,
  title text NOT NULL,
  position int NOT NULL DEFAULT 0,
  body text NOT NULL DEFAULT '',
  version int NOT NULL DEFAULT 0,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, key)
);
CREATE TABLE public.project_section_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.project_sections(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version int NOT NULL,
  body text NOT NULL,
  edited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.project_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  section_id uuid REFERENCES public.project_sections(id) ON DELETE CASCADE,
  paper_id uuid REFERENCES public.project_papers(id) ON DELETE CASCADE,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
  assignee_id uuid,
  due_date date,
  done boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.project_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  kind text NOT NULL,
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.project_members (user_id);
CREATE INDEX ON public.project_activity (project_id, created_at DESC);
CREATE INDEX ON public.notifications (user_id, read, created_at DESC);

GRANT SELECT, UPDATE ON public.projects TO authenticated;
GRANT SELECT ON public.project_members TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.project_papers TO authenticated;
GRANT SELECT ON public.project_sections TO authenticated;
GRANT SELECT ON public.project_section_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_tasks TO authenticated;
GRANT SELECT ON public.project_activity TO authenticated;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.projects, public.project_members, public.project_papers, public.project_sections, public.project_section_versions, public.project_comments, public.project_tasks, public.project_activity, public.notifications TO service_role;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_section_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_project_member(_project uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.project_members WHERE project_id = _project AND user_id = _user AND state = 'accepted')
$$;
CREATE OR REPLACE FUNCTION public.is_project_owner(_project uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.project_members WHERE project_id = _project AND user_id = _user AND state = 'accepted' AND role = 'owner')
$$;
CREATE OR REPLACE FUNCTION public.is_project_invitee(_project uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.project_members WHERE project_id = _project AND user_id = _user AND state IN ('invited','accepted'))
$$;

CREATE POLICY "members and invitees read project" ON public.projects FOR SELECT TO authenticated USING (public.is_project_invitee(id, auth.uid()));
CREATE POLICY "members update project" ON public.projects FOR UPDATE TO authenticated USING (public.is_project_member(id, auth.uid())) WITH CHECK (public.is_project_member(id, auth.uid()));
CREATE POLICY "read memberships" ON public.project_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_project_member(project_id, auth.uid()));
CREATE POLICY "members read papers" ON public.project_papers FOR SELECT TO authenticated USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "members add papers" ON public.project_papers FOR INSERT TO authenticated WITH CHECK (public.is_project_member(project_id, auth.uid()) AND added_by = auth.uid());
CREATE POLICY "members remove papers" ON public.project_papers FOR DELETE TO authenticated USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "members read sections" ON public.project_sections FOR SELECT TO authenticated USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "members read versions" ON public.project_section_versions FOR SELECT TO authenticated USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "members read comments" ON public.project_comments FOR SELECT TO authenticated USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "members add comments" ON public.project_comments FOR INSERT TO authenticated WITH CHECK (public.is_project_member(project_id, auth.uid()) AND author_id = auth.uid());
CREATE POLICY "members resolve comments" ON public.project_comments FOR UPDATE TO authenticated USING (public.is_project_member(project_id, auth.uid())) WITH CHECK (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "authors delete comments" ON public.project_comments FOR DELETE TO authenticated USING (author_id = auth.uid());
CREATE POLICY "members read tasks" ON public.project_tasks FOR SELECT TO authenticated USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "members add tasks" ON public.project_tasks FOR INSERT TO authenticated WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "members update tasks" ON public.project_tasks FOR UPDATE TO authenticated USING (public.is_project_member(project_id, auth.uid())) WITH CHECK (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "members delete tasks" ON public.project_tasks FOR DELETE TO authenticated USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "members read activity" ON public.project_activity FOR SELECT TO authenticated USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own notifications mark read" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Only status/title/description/archived may change through direct updates; ownership changes go through functions.
CREATE OR REPLACE FUNCTION public.projects_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.owner_id <> OLD.owner_id AND current_setting('app.ownership_transfer', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Use transfer_project_ownership';
  END IF;
  IF NEW.archived <> OLD.archived AND auth.uid() IS NOT NULL AND NOT public.is_project_owner(NEW.id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the owner can archive';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER projects_guard BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.projects_guard();

-- Activity + notifications (append-only, written only by triggers).
CREATE OR REPLACE FUNCTION public.log_project(_project uuid, _actor uuid, _action text, _detail jsonb, _notify text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.project_activity (project_id, actor_id, action, detail) VALUES (_project, _actor, _action, coalesce(_detail, '{}'::jsonb));
  IF _notify IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, project_id, kind, body)
    SELECT m.user_id, _project, _action, _notify FROM public.project_members m
    WHERE m.project_id = _project AND m.state = 'accepted' AND m.user_id IS DISTINCT FROM _actor;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.log_project(uuid, uuid, text, jsonb, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.actor_name(_user uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(nullif(trim(first_name || ' ' || last_name), ''), 'Someone') FROM public.profiles WHERE id = _user
$$;

CREATE OR REPLACE FUNCTION public.trg_project_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid := auth.uid(); t text; pid uuid;
BEGIN
  IF TG_TABLE_NAME = 'projects' THEN
    pid := NEW.id;
    SELECT title INTO t FROM public.projects WHERE id = pid;
    IF TG_OP = 'INSERT' THEN PERFORM public.log_project(pid, coalesce(actor, NEW.owner_id), 'created', jsonb_build_object('title', NEW.title), NULL);
    ELSIF NEW.status <> OLD.status THEN PERFORM public.log_project(pid, actor, 'status', jsonb_build_object('from', OLD.status, 'to', NEW.status), public.actor_name(actor) || ' moved "' || t || '" to ' || NEW.status);
    ELSIF NEW.owner_id <> OLD.owner_id THEN PERFORM public.log_project(pid, actor, 'ownership', jsonb_build_object('to', NEW.owner_id), NULL);
    ELSIF NEW.archived <> OLD.archived THEN PERFORM public.log_project(pid, actor, CASE WHEN NEW.archived THEN 'archived' ELSE 'unarchived' END, '{}'::jsonb, NULL);
    ELSIF NEW.title <> OLD.title OR NEW.description <> OLD.description THEN PERFORM public.log_project(pid, actor, 'details', '{}'::jsonb, NULL);
    END IF;
    RETURN NEW;
  END IF;
  pid := coalesce(NEW.project_id, OLD.project_id);
  SELECT title INTO t FROM public.projects WHERE id = pid;
  IF TG_TABLE_NAME = 'project_members' THEN
    IF TG_OP = 'INSERT' AND NEW.state = 'invited' THEN
      PERFORM public.log_project(pid, coalesce(actor, NEW.invited_by), 'invited', jsonb_build_object('user', NEW.user_id, 'name', public.actor_name(NEW.user_id)), NULL);
      INSERT INTO public.notifications (user_id, project_id, kind, body) VALUES (NEW.user_id, pid, 'invited', public.actor_name(coalesce(actor, NEW.invited_by)) || ' invited you to "' || t || '"');
    ELSIF TG_OP = 'UPDATE' AND NEW.state <> OLD.state THEN
      PERFORM public.log_project(pid, NEW.user_id, CASE WHEN NEW.state = 'accepted' THEN 'joined' ELSE 'declined' END, '{}'::jsonb,
        CASE WHEN NEW.state = 'accepted' THEN public.actor_name(NEW.user_id) || ' joined "' || t || '"' END);
    ELSIF TG_OP = 'UPDATE' AND NEW.role <> OLD.role THEN
      PERFORM public.log_project(pid, actor, 'role', jsonb_build_object('user', NEW.user_id, 'name', public.actor_name(NEW.user_id), 'role', NEW.role), NULL);
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.log_project(pid, actor, CASE WHEN actor = OLD.user_id THEN 'left' ELSE 'removed' END, jsonb_build_object('user', OLD.user_id, 'name', public.actor_name(OLD.user_id)), NULL);
    END IF;
  ELSIF TG_TABLE_NAME = 'project_papers' THEN
    IF TG_OP = 'INSERT' THEN PERFORM public.log_project(pid, coalesce(actor, NEW.added_by), 'paper_added', jsonb_build_object('title', NEW.title), NULL);
    ELSE PERFORM public.log_project(pid, actor, 'paper_removed', jsonb_build_object('title', OLD.title), NULL); END IF;
  ELSIF TG_TABLE_NAME = 'project_section_versions' THEN
    PERFORM public.log_project(pid, NEW.edited_by, 'section_edited', jsonb_build_object('section', (SELECT title FROM public.project_sections WHERE id = NEW.section_id), 'version', NEW.version),
      public.actor_name(NEW.edited_by) || ' edited "' || (SELECT title FROM public.project_sections WHERE id = NEW.section_id) || '" in "' || t || '"');
  ELSIF TG_TABLE_NAME = 'project_comments' THEN
    IF TG_OP = 'INSERT' THEN PERFORM public.log_project(pid, NEW.author_id, 'commented', jsonb_build_object('excerpt', left(NEW.body, 120)), public.actor_name(NEW.author_id) || ' commented on "' || t || '"');
    ELSIF TG_OP = 'UPDATE' AND NEW.resolved <> OLD.resolved THEN PERFORM public.log_project(pid, actor, CASE WHEN NEW.resolved THEN 'comment_resolved' ELSE 'comment_reopened' END, jsonb_build_object('excerpt', left(NEW.body, 120)), NULL);
    END IF;
  ELSIF TG_TABLE_NAME = 'project_tasks' THEN
    IF TG_OP = 'INSERT' THEN PERFORM public.log_project(pid, NEW.created_by, 'task_added', jsonb_build_object('title', NEW.title), NULL);
    ELSIF TG_OP = 'UPDATE' AND NEW.done <> OLD.done THEN PERFORM public.log_project(pid, actor, CASE WHEN NEW.done THEN 'task_done' ELSE 'task_reopened' END, jsonb_build_object('title', NEW.title), NULL);
    ELSIF TG_OP = 'DELETE' THEN PERFORM public.log_project(pid, actor, 'task_removed', jsonb_build_object('title', OLD.title), NULL);
    END IF;
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
REVOKE EXECUTE ON FUNCTION public.trg_project_activity() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER activity_projects AFTER INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.trg_project_activity();
CREATE TRIGGER activity_members AFTER INSERT OR UPDATE OR DELETE ON public.project_members FOR EACH ROW EXECUTE FUNCTION public.trg_project_activity();
CREATE TRIGGER activity_papers AFTER INSERT OR DELETE ON public.project_papers FOR EACH ROW EXECUTE FUNCTION public.trg_project_activity();
CREATE TRIGGER activity_versions AFTER INSERT ON public.project_section_versions FOR EACH ROW EXECUTE FUNCTION public.trg_project_activity();
CREATE TRIGGER activity_comments AFTER INSERT OR UPDATE ON public.project_comments FOR EACH ROW EXECUTE FUNCTION public.trg_project_activity();
CREATE TRIGGER activity_tasks AFTER INSERT OR UPDATE OR DELETE ON public.project_tasks FOR EACH ROW EXECUTE FUNCTION public.trg_project_activity();

-- Section save with conflict check; each save keeps a version.
CREATE OR REPLACE FUNCTION public.save_project_section(_section uuid, _expected_version int, _body text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.project_sections; v int;
BEGIN
  SELECT * INTO s FROM public.project_sections WHERE id = _section FOR UPDATE;
  IF s.id IS NULL OR NOT public.is_project_member(s.project_id, auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF s.version <> _expected_version THEN RAISE EXCEPTION 'conflict' USING ERRCODE = 'P0409'; END IF;
  v := s.version + 1;
  UPDATE public.project_sections SET body = _body, version = v, updated_by = auth.uid(), updated_at = now() WHERE id = _section;
  INSERT INTO public.project_section_versions (section_id, project_id, version, body, edited_by) VALUES (_section, s.project_id, v, _body, auth.uid());
  RETURN v;
END $$;
REVOKE EXECUTE ON FUNCTION public.save_project_section(uuid, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_project_section(uuid, int, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_project_invite(_project uuid, _accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.project_members SET state = CASE WHEN _accept THEN 'accepted' ELSE 'declined' END
  WHERE project_id = _project AND user_id = auth.uid() AND state = 'invited';
  IF NOT FOUND THEN RAISE EXCEPTION 'No pending invitation'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.leave_project(_project uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_project_owner(_project, auth.uid()) THEN RAISE EXCEPTION 'Transfer ownership before leaving'; END IF;
  DELETE FROM public.project_members WHERE project_id = _project AND user_id = auth.uid();
END $$;
CREATE OR REPLACE FUNCTION public.remove_project_member(_project uuid, _user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_project_owner(_project, auth.uid()) OR _user = auth.uid() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  DELETE FROM public.project_members WHERE project_id = _project AND user_id = _user;
END $$;
CREATE OR REPLACE FUNCTION public.transfer_project_ownership(_project uuid, _user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_project_owner(_project, auth.uid()) OR NOT public.is_project_member(_project, _user) OR _user = auth.uid() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  PERFORM set_config('app.ownership_transfer', 'on', true);
  UPDATE public.project_members SET role = 'editor' WHERE project_id = _project AND user_id = auth.uid();
  UPDATE public.project_members SET role = 'owner' WHERE project_id = _project AND user_id = _user;
  UPDATE public.projects SET owner_id = _user WHERE id = _project;
END $$;
CREATE OR REPLACE FUNCTION public.delete_project(_project uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_project_owner(_project, auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  DELETE FROM public.projects WHERE id = _project;
END $$;
-- Names and roles of the people in a project (profiles are otherwise private).
CREATE OR REPLACE FUNCTION public.project_people(_project uuid)
RETURNS TABLE(user_id uuid, name text, institution text, role text, state text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.user_id, public.actor_name(m.user_id), p.institution, m.role, m.state
  FROM public.project_members m JOIN public.profiles p ON p.id = m.user_id
  WHERE m.project_id = _project AND public.is_project_invitee(_project, auth.uid()) AND m.state <> 'declined'
  ORDER BY (m.role = 'owner') DESC, m.created_at
$$;
REVOKE EXECUTE ON FUNCTION public.respond_project_invite(uuid, boolean), public.leave_project(uuid), public.remove_project_member(uuid, uuid), public.transfer_project_ownership(uuid, uuid), public.delete_project(uuid), public.project_people(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_project_invite(uuid, boolean), public.leave_project(uuid), public.remove_project_member(uuid, uuid), public.transfer_project_ownership(uuid, uuid), public.delete_project(uuid), public.project_people(uuid), public.is_project_member(uuid, uuid), public.is_project_owner(uuid, uuid), public.is_project_invitee(uuid, uuid) TO authenticated;