import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Logo } from "@/components/Logo";
import { ConfidentialNotice } from "@/components/ConfidentialNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidOrcid, normaliseOrcid } from "@/lib/orcid";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Lattice Scout" },
      { name: "description", content: "Sign in or create your Lattice Scout account with email or Google." },
      { property: "og:title", content: "Sign in — Lattice Scout" },
      { property: "og:description", content: "Find the paper hiding in your drawer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const features = [
  ["Your profile, built for you", "We read your published work from OpenAlex."],
  ["Complementary collaborators", "Similar topics, different methods."],
  ["Research gaps", "Every suggestion backed by real papers."],
];

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
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
      if (mode === "signin") {
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
            emailRedirectTo: window.location.origin,
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
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="flex flex-col justify-between p-10 lg:p-16">
        <Logo tag />
        <div className="my-12 max-w-md">
          <h1 className="font-serif text-5xl leading-tight">Find the paper hiding in your drawer.</h1>
          <ul className="mt-10 space-y-5">
            {features.map(([t, d]) => (
              <li key={t} className="border-l-2 border-primary pl-4">
                <div className="font-medium">{t}</div>
                <div className="text-sm text-muted-foreground">{d}</div>
              </li>
            ))}
          </ul>
        </div>
        <p className="font-mono text-xs text-muted-foreground">Open science · Published data only</p>
      </section>
      <section className="flex items-center justify-center p-6 lg:p-16">
        <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 shadow-sm">
          {sent ? (
            <div className="space-y-3 text-center">
              <h2 className="font-serif text-2xl">Check your email</h2>
              <p className="text-muted-foreground">We sent a confirmation link to {f.email}. Click it to finish creating your account.</p>
              <Button variant="ghost" onClick={() => { setSent(false); setMode("signin"); }}>Back to sign in</Button>
            </div>
          ) : (
            <>
              <div>
                <h2 className="font-serif text-2xl">{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
                <p className="text-sm text-muted-foreground">
                  {mode === "signin" ? "Sign in to continue." : "Your profile builds itself from your publications."}
                </p>
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={google}>
                Continue with Google
              </Button>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" /> or with email <div className="h-px flex-1 bg-border" />
              </div>
              <form onSubmit={submit} className="space-y-4">
                {mode === "signup" && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="first" label="First name"><Input id="first" required value={f.first} onChange={set("first")} /></Field>
                    <Field id="last" label="Last name"><Input id="last" required value={f.last} onChange={set("last")} /></Field>
                  </div>
                )}
                <Field id="email" label="Email"><Input id="email" type="email" required value={f.email} onChange={set("email")} /></Field>
                <Field id="password" label="Password"><Input id="password" type="password" required minLength={8} value={f.password} onChange={set("password")} /></Field>
                {mode === "signup" && (
                  <>
                    <Field id="institution" label="Institution"><Input id="institution" value={f.institution} onChange={set("institution")} /></Field>
                    <Field id="orcid" label="ORCID (optional)">
                      <Input id="orcid" className="font-mono" placeholder="0000-0000-0000-0000" value={f.orcid} onChange={set("orcid")} />
                    </Field>
                  </>
                )}
                <Button type="submit" className="w-full" disabled={busy}>
                  {mode === "signin" ? "Sign in" : "Create account"}
                </Button>
              </form>
              <p className="text-center text-sm text-muted-foreground">
                {mode === "signin" ? "New here? " : "Already have an account? "}
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
