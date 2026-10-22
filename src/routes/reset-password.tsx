import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — Lattice Scout" },
      { name: "description", content: "Set a new password for your Lattice Scout account." },
      { property: "og:title", content: "Choose a new password — Lattice Scout" },
      { property: "og:description", content: "Set a new password for your Lattice Scout account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "ready" | "invalid">("checking");
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // The emailed link signs the user in with a short-lived recovery session.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) setState("ready");
    });
    const hash = window.location.hash;
    const err = new URLSearchParams(hash.slice(1)).get("error_description");
    if (err) { setState("invalid"); return () => sub.subscription.unsubscribe(); }
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setState((s) => (s === "ready" || data.session ? "ready" : "invalid"));
    }, hash.includes("type=recovery") || window.location.search.includes("code=") ? 1500 : 300);
    return () => { clearTimeout(t); sub.subscription.unsubscribe(); };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { toast.error("Use at least 8 characters."); return; }
    if (pw !== again) { toast.error("The two passwords do not match."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    navigate({ to: "/profile", replace: true });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <Logo tag />
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 shadow-sm">
        <h1 className="font-serif text-2xl">Choose a new password</h1>
        {state === "checking" && <p className="text-sm text-muted-foreground">Checking your reset link…</p>}
        {state === "invalid" && (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">This reset link is invalid or has expired. Request a new one from the sign-in page.</p>
            <Button asChild variant="outline"><Link to="/auth">Back to sign in</Link></Button>
          </div>
        )}
        {state === "ready" && (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="pw">New password</Label><Input id="pw" type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></div>
            <div className="space-y-1.5"><Label htmlFor="pw2">Repeat new password</Label><Input id="pw2" type="password" required minLength={8} value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" /></div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save new password"}</Button>
          </form>
        )}
      </div>
    </main>
  );
}
