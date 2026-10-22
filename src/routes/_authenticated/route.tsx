import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    // Remember the person's time zone so the nightly refresh runs during their night.
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) void supabase.from("profiles").update({ timezone: tz }).eq("id", data.user.id).neq("timezone", tz).then(async (r) => {
      if (!r.error) await supabase.from("profiles").update({ timezone: tz }).eq("id", data.user.id).is("timezone", null);
    });
    return { user: data.user };
  },
  component: () => (
    <>
      <AppHeader />
      <Outlet />
    </>
  ),
});
