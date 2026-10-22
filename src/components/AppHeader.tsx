import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const GROUPS = [
  {
    label: "Your research",
    items: [
      { to: "/profile", label: "Profile" },
      { to: "/confirm", label: "Confirm publication profile" },
    ],
  },
  {
    label: "Collaboration",
    items: [
      { to: "/matches", label: "Matches" },
      { to: "/opportunities", label: "Opportunities" },
      { to: "/opportunities/manage", label: "Saved opportunities", sub: true },
    ],
  },
] as const;

/** Single signed-in header: logo goes to profile, everything else lives in the burger menu. */
export function AppHeader() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    setOpen(false);
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link to="/profile" aria-label="Go to your profile" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo />
        </Link>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle className="font-serif">Menu</SheetTitle>
            </SheetHeader>
            <nav className="mt-6 space-y-6 px-4">
              {GROUPS.map((g) => (
                <div key={g.label}>
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{g.label}</p>
                  <ul className="space-y-1">
                    {g.items.map((it) => (
                      <li key={it.to}>
                        <Link
                          to={it.to}
                          onClick={() => setOpen(false)}
                          activeOptions={{ exact: true }}
                          className={`block rounded-md px-3 py-2 text-sm hover:bg-muted ${"sub" in it ? "ml-4 border-l pl-4" : ""}`}
                          activeProps={{ className: "bg-accent font-medium text-accent-foreground" }}
                        >
                          {it.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="border-t pt-4">
                <button onClick={signOut} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted">
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
