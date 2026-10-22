import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Lattice Scout — find your research collaborators" },
      { name: "description", content: "Lattice Scout builds your research profile from your publications and finds complementary collaborators." },
      { property: "og:title", content: "Lattice Scout" },
      { property: "og:description", content: "Your research profile, built from your publications." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? "/profile" : "/auth" });
  },
  component: () => null,
});
