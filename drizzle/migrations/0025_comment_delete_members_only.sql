DROP POLICY IF EXISTS "authors delete comments" ON public.project_comments;
CREATE POLICY "authors delete comments" ON public.project_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() AND public.is_project_member(project_id, auth.uid()));
