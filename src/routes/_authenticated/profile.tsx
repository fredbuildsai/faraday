import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { ConfidentialNotice } from "@/components/ConfidentialNotice";
import { Button } from "@/components/ui/button";

const profileQuery = queryOptions({
  queryKey: ["my-profile"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("profiles")
      .select("first_name, last_name, institution, orcid")
      .eq("id", u.user!.id)
      .maybeSingle();
    if (error) throw error;
    return { profile: data, email: u.user!.email ?? "" };
  },
});

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — Lattice Scout" },
      { name: "description", content: "Your Lattice Scout research profile." },
      { property: "og:title", content: "Your profile — Lattice Scout" },
      { property: "og:description", content: "Your Lattice Scout research profile." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery),
  component: ProfilePage,
});

function ProfilePage() {
  const { data } = useSuspenseQuery(profileQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const p = data.profile;
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ") || data.email;
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Logo />
          <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <div className="flex items-center gap-5 rounded-xl border bg-card p-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary font-serif text-xl text-primary-foreground">
            {initials}
          </div>
          <div>
            <h1 className="font-serif text-3xl">{name}</h1>
            <p className="text-muted-foreground">{p?.institution || "No institution yet"}</p>
            {p?.orcid && (
              <span className="mt-2 inline-block rounded-full bg-accent px-3 py-0.5 font-mono text-xs text-accent-foreground">
                ORCID {p.orcid}
              </span>
            )}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6 text-muted-foreground">
          Your publications will appear here once the import from OpenAlex is added.
        </div>
        <ConfidentialNotice />
      </main>
    </div>
  );
}
