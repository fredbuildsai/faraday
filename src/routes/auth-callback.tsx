import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth-callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Confirming your account — Lattice Scout" },
      { name: "description", content: "Finishing your Lattice Scout sign-up." },
      { property: "og:title", content: "Confirming your account — Lattice Scout" },
      { property: "og:description", content: "Finishing your Lattice Scout sign-up." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthCallback,
});

/** Landing page for email confirmation links: waits for the session, then enters the app. */
function AuthCallback() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let done = false;
    const go = () => { if (!done) { done = true; navigate({ to: "/profile", replace: true }); } };
    const hashErr = new URLSearchParams(window.location.hash.slice(1)).get("error_description");
    const queryErr = new URLSearchParams(window.location.search).get("error_description");
    if (hashErr || queryErr) { setFailed(hashErr ?? queryErr); return; }

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => { if (session) go(); });
    (async () => {
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) { setFailed(error.message); return; }
      }
      // Hash tokens are parsed by the client on load; poll briefly for slow networks.
      for (let i = 0; i < 20 && !done; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) return go();
        await new Promise((r) => setTimeout(r, 500));
      }
      if (!done) setFailed("We could not confirm this link. It may have expired or already been used.");
    })();
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6 text-center">
      <Logo tag />
      <div className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-8 shadow-sm">
        {failed ? (
          <>
            <h1 className="font-serif text-2xl">Link not valid</h1>
            <p className="text-sm text-muted-foreground">{failed} If your account is already confirmed, just sign in.</p>
            <Button asChild><Link to="/auth">Go to sign in</Link></Button>
          </>
        ) : (
          <>
            <h1 className="font-serif text-2xl">Confirming your account…</h1>
            <p className="text-sm text-muted-foreground">One moment, we are signing you in.</p>
          </>
        )}
      </div>
    </main>
  );
}
