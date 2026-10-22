import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/** Collapsible card used across pages (profile sections, match cards). */
export function Section({
  title,
  subtitle,
  count,
  aside,
  defaultOpen = true,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  count?: number;
  aside?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border bg-card">
      <div className="flex items-center gap-3 p-6">
        <CollapsibleTrigger className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
          <div className="min-w-0">
            <h2 className="font-serif text-xl">
              {title}
              {count !== undefined && <span className="ml-2 font-mono text-sm text-muted-foreground">{count}</span>}
            </h2>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        {aside && <div className="flex shrink-0 items-center gap-2">{aside}</div>}
      </div>
      <CollapsibleContent className="px-6 pb-6">{children}</CollapsibleContent>
    </Collapsible>
  );
}
