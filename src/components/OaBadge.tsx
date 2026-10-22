import { Unlock } from "lucide-react";

/** Shown only for open-access papers; closed papers stay unlabelled. */
export function OaBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
      <Unlock className="h-3 w-3" aria-hidden /> Open access
    </span>
  );
}
