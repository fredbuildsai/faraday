import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { myProjectsQuery, notificationsQuery } from "@/lib/projects-queries";
import { STATUS_LABEL, type ProjectStatus } from "@/lib/projects";

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({ meta: [
    { title: "Shared opportunities — Lattice Scout" },
    { name: "description", content: "Opportunities you develop together with other researchers, with invitations and updates." },
    { property: "og:title", content: "Shared opportunities — Lattice Scout" },
    { property: "og:description", content: "Opportunities you develop together with other researchers, with invitations and updates." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(myProjectsQuery), context.queryClient.ensureQueryData(notificationsQuery)]),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { data: projects } = useSuspenseQuery(myProjectsQuery);
  const { data: notes } = useSuspenseQuery(notificationsQuery);
  const qc = useQueryClient();
  const invites = projects.filter((p) => p.state === "invited");
  const mine = projects.filter((p) => p.state === "accepted");
  const unread = notes.filter((n) => !n.read);

  async function respond(id: string, accept: boolean) {
    const { error } = await supabase.rpc("respond_project_invite", { _project: id, _accept: accept });
    if (error) { toast.error("Could not answer the invitation."); return; }
    toast.success(accept ? "You joined" : "Invitation declined");
    await qc.invalidateQueries({ queryKey: ["projects"] });
  }
  async function markAllRead() {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    await qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="font-serif text-3xl">Shared opportunities</h1><p className="text-muted-foreground">Proposals you develop together with other Lattice Scout members.</p></div>
        <NewProjectDialog trigger={<Button><Plus className="h-4 w-4" /> New opportunity</Button>} />
      </div>

      {!!invites.length && (
        <section className="space-y-3">
          <h2 className="font-serif text-xl">Invitations</h2>
          {invites.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
              <div><p className="font-medium">{p.title}</p><p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p></div>
              <div className="flex gap-2"><Button size="sm" onClick={() => respond(p.id, true)}>Accept</Button><Button size="sm" variant="outline" onClick={() => respond(p.id, false)}>Decline</Button></div>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-serif text-xl">Your shared opportunities</h2>
        {mine.length ? mine.map((p) => (
          <Link key={p.id} to="/projects/$id" params={{ id: p.id }} className="block rounded-xl border bg-card p-4 hover:bg-muted/40">
            <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{p.title}</p><Badge variant="secondary">{STATUS_LABEL[p.status as ProjectStatus]}</Badge>{p.role === "owner" && <Badge variant="outline">Owner</Badge>}{p.archived && <Badge variant="outline">Archived</Badge>}</div>
            <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>
          </Link>
        )) : <p className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">Nothing shared yet. Create one, or turn a saved opportunity into a shared one.</p>}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="font-serif text-xl">Updates</h2>{!!unread.length && <Button size="sm" variant="ghost" onClick={markAllRead}>Mark all as read</Button>}</div>
        {notes.length ? (
          <ul className="divide-y rounded-xl border bg-card">
            {notes.map((n) => (
              <li key={n.id} className={`flex items-center justify-between gap-3 px-4 py-3 text-sm ${n.read ? "text-muted-foreground" : "font-medium"}`}>
                {n.project_id ? <Link to="/projects/$id" params={{ id: n.project_id }} className="hover:underline">{n.body}</Link> : <span>{n.body}</span>}
                <span className="shrink-0 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">No updates yet.</p>}
      </section>
    </main>
  );
}
