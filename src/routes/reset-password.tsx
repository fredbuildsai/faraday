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
      { title: "Choose a new password — Faraday" },
      { name: "description", content: "Set a new password for your Faraday account." },
      { property: "og:title", content: "Choose a new password — Faraday" },
      { property: "og:description", content: "Set a new password for your Faraday account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  // "code" = no usable link session; let the person type the 6-digit code from the email.
  const [state, setState] = useState<"checking" | "ready" | "code">("checking");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let done = false;
    const ready = () => { if (!done) { done = true; setState("ready"); } };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) ready();
    });
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    const err = hash.get("error_description") ?? query.get("error_description");
    if (err) {
      // Typical for university mail: a link scanner already opened the single-use link.
      setLinkError(err);
      setState("code");
      return () => sub.subscription.unsubscribe();
    }
    (async () => {
      const code = query.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) setLinkError(error.message);
      }
      const hasLink = !!code || hash.has("access_token");
      for (let i = 0; i < (hasLink ? 20 : 2) && !done; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) return ready();
        await new Promise((r) => setTimeout(r, 500));
      }
      if (!done) setState("code");
    })();
    return () => { done = true; sub.subscription.unsubscribe(); };
  }, []);

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: otp.trim(), type: "recovery" });
    setBusy(false);
    if (error) { toast.error("That code is not valid or has expired. Request a new one."); return; }
    setState("ready");
  }

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
        {state === "code" && (
          <form onSubmit={verifyCode} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {linkError
                ? "This link was already used or has expired — some university mail systems open links automatically. Enter the 6-digit code from the email instead."
                : "Enter your email and the 6-digit code from the reset email."}
            </p>
            <div className="space-y-1.5"><Label htmlFor="em">Email</Label><Input id="em" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
            <div className="space-y-1.5"><Label htmlFor="otp">Code</Label><Input id="otp" inputMode="numeric" required pattern="[0-9]{6,8}" value={otp} onChange={(e) => setOtp(e.target.value)} autoComplete="one-time-code" /></div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Checking…" : "Continue"}</Button>
            <Button asChild variant="ghost" className="w-full"><Link to="/auth">Request a new email</Link></Button>
          </form>
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
