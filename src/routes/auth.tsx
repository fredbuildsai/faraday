import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Logo } from "@/components/Logo";
import { ConfidentialNotice } from "@/components/ConfidentialNotice";
import { CandleQuote } from "@/components/CandleQuote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidOrcid, normaliseOrcid } from "@/lib/orcid";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Faraday" },
      { name: "description", content: "Sign in or create your Faraday account with email or Google." },
      { property: "og:title", content: "Sign in — Faraday" },
      { property: "og:description", content: "Get out of the cage." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const features = ["Your profile, built for you", "Complementary collaborators", "Research gaps"];

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [f, setF] = useState({ email: "", password: "", first: "", last: "", institution: "", orcid: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/profile", replace: true });
    });
  }, [navigate]);

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) {
      toast.error("Google sign-in failed. Please try again.");
      return;
    }
    if (r.redirected) return;
    navigate({ to: "/profile", replace: true });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(f.email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) { toast.error(error.message); return; }
        setSent(true);
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
        if (error) { toast.error(error.message); return; }
        navigate({ to: "/profile", replace: true });
      } else {
        if (f.orcid && !isValidOrcid(f.orcid)) {
          toast.error("That ORCID doesn't look right. Check the digits.");
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: f.email,
          password: f.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth-callback`,
            data: {
              first_name: f.first.trim(),
              last_name: f.last.trim(),
              institution: f.institution.trim(),
              orcid: f.orcid ? normaliseOrcid(f.orcid) : "",
            },
          },
        });
        if (error) { toast.error(error.message); return; }
        setSent(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen content-start lg:grid-cols-2 lg:content-stretch">
      <section className="flex flex-col items-center gap-4 px-6 pb-2 pt-6 text-center lg:justify-between lg:gap-0 lg:p-16">
        <Logo tag size="large" />
        <div className="max-w-md lg:my-12">
          <h1 className="font-serif text-2xl font-semibold leading-tight tracking-tight lg:text-3xl">Get out of the cage.</h1>
          <div className="mx-auto mt-6 max-w-md"><CandleQuote /></div>
          <ul className="mx-auto mt-10 hidden max-w-xs space-y-5 text-left lg:block">
            {features.map((t) => (
              <li key={t} className="border-l-2 border-primary pl-4 font-medium">{t}</li>
            ))}
          </ul>
        </div>
        <p className="hidden font-mono text-xs text-muted-foreground lg:block">Open science · Published data only</p>
      </section>
      <section className="flex items-start justify-center p-4 lg:items-center lg:p-16">
        <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          {sent ? (
            <div className="space-y-3 text-center">
              <h2 className="font-serif text-2xl">Check your email</h2>
              <p className="text-muted-foreground">{mode === "forgot" ? `If an account exists for ${f.email}, we sent a link to choose a new password.` : `We sent a confirmation link to ${f.email}. Click it to finish creating your account.`}</p>
              <Button variant="ghost" onClick={() => { setSent(false); setMode("signin"); }}>Back to sign in</Button>
            </div>
          ) : (
            <>
              <div className="text-center">
                <h2 className="font-serif text-2xl">{mode === "signin" ? "Welcome back" : mode === "forgot" ? "Reset your password" : "Create your account"}</h2>
                <p className="text-sm text-muted-foreground">
                  {mode === "signin" ? "Sign in to continue." : mode === "forgot" ? "Enter your email and we will send you a reset link." : "Your profile builds itself from your publications."}
                </p>
              </div>
              {mode !== "forgot" && <>
                <Button type="button" variant="outline" className="w-full gap-2" onClick={google}>
                  <GoogleLogo /> Continue with Google
                </Button>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="h-px flex-1 bg-border" /> or with email <div className="h-px flex-1 bg-border" />
                </div>
              </>}
              <form onSubmit={submit} className="space-y-4">
                {mode === "signup" && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="first" label="First name"><Input id="first" required value={f.first} onChange={set("first")} /></Field>
                    <Field id="last" label="Last name"><Input id="last" required value={f.last} onChange={set("last")} /></Field>
                  </div>
                )}
                <Field id="email" label="Email"><Input id="email" type="email" required value={f.email} onChange={set("email")} /></Field>
                {mode !== "forgot" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      {mode === "signin" && <button type="button" className="text-xs text-primary underline-offset-4 hover:underline" onClick={() => setMode("forgot")}>Forgot password?</button>}
                    </div>
                    <Input id="password" type="password" required minLength={8} value={f.password} onChange={set("password")} />
                  </div>
                )}
                {mode === "signup" && (
                  <>
                    <Field id="institution" label="Institution"><Input id="institution" value={f.institution} onChange={set("institution")} /></Field>
                    <Field id="orcid" label="ORCID (optional)">
                      <Input id="orcid" className="font-mono" placeholder="0000-0000-0000-0000" value={f.orcid} onChange={set("orcid")} />
                    </Field>
                  </>
                )}
                <Button type="submit" className="w-full" disabled={busy}>
                  {mode === "signin" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Create account"}
                </Button>
              </form>
              <p className="text-center text-sm text-muted-foreground">
                {mode === "signin" ? "New here? " : mode === "forgot" ? "Remembered it? " : "Already have an account? "}
                <button type="button" className="font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
                  {mode === "signin" ? "Create account" : "Sign in"}
                </button>
              </p>
              {mode === "signup" && <ConfidentialNotice />}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/** Official multi-colour Google "G". Brand colours are fixed by Google's guidelines, so they are not theme tokens. */
function GoogleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-4 w-4">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
