import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const myProjectsQuery = queryOptions({
  queryKey: ["projects"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("project_members").select("role, state, projects(id, title, description, status, archived, updated_at)").eq("user_id", u.user?.id ?? "").neq("state", "declined");
    if (error) throw error;
    return (data ?? []).filter((r) => r.projects).map((r) => ({ role: r.role, state: r.state, ...(r.projects as any) })) as { role: string; state: string; id: string; title: string; description: string; status: string; archived: boolean; updated_at: string }[];
  },
});

export const notificationsQuery = queryOptions({
  queryKey: ["notifications"],
  queryFn: async () => {
    const { data, error } = await supabase.from("notifications").select("id, project_id, kind, body, read, created_at").order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return data ?? [];
  },
  refetchInterval: 60_000,
});

export function projectQuery(id: string) {
  return queryOptions({
    queryKey: ["project", id],
    queryFn: async () => {
      const [project, people, sections, papers, comments, tasks, activity, items, references, contributions] = await Promise.all([
        supabase.from("projects").select("*").eq("id", id).maybeSingle(),
        supabase.rpc("project_people", { _project: id }),
        supabase.from("project_sections").select("*").eq("project_id", id).order("position"),
        supabase.from("project_papers").select("*").eq("project_id", id).order("created_at"),
        supabase.from("project_comments").select("*").eq("project_id", id).order("created_at"),
        supabase.from("project_tasks").select("*").eq("project_id", id).order("created_at"),
        supabase.from("project_activity").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(100),
        supabase.from("project_items").select("*").eq("project_id", id).order("created_at"),
        supabase.from("project_references").select("*").eq("project_id", id).order("created_at"),
        supabase.from("project_contributions").select("*").eq("project_id", id).order("created_at"),
      ]);
      if (project.error) throw project.error;
      return { project: project.data, people: people.data ?? [], sections: sections.data ?? [], papers: papers.data ?? [], comments: comments.data ?? [], tasks: tasks.data ?? [], activity: activity.data ?? [], items: items.data ?? [], references: references.data ?? [], contributions: contributions.data ?? [] };
    },
  });
}
