CREATE OR REPLACE FUNCTION public.log_project(_project uuid, _actor uuid, _action text, _detail jsonb, _notify text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Rows removed while their project is being deleted leave no trace.
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = _project) THEN RETURN; END IF;
  INSERT INTO public.project_activity (project_id, actor_id, action, detail) VALUES (_project, _actor, _action, coalesce(_detail, '{}'::jsonb));
  IF _notify IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, project_id, kind, body)
    SELECT m.user_id, _project, _action, _notify FROM public.project_members m
    WHERE m.project_id = _project AND m.state = 'accepted' AND m.user_id IS DISTINCT FROM _actor;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.log_project(uuid, uuid, text, jsonb, text) FROM PUBLIC, anon, authenticated;