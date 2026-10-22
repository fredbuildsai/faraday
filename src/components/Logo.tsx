/** Compact logo mark without the wordmark, for badges on cards. */
export function LogoMark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="7" className="fill-primary" />
      <g className="stroke-primary-foreground" strokeWidth="1.6" fill="none">
        <path d="M9 9h14v14H9zM16 9v14M9 16h14" />
      </g>
      <g className="fill-primary-foreground">
        <circle cx="9" cy="9" r="2" /><circle cx="23" cy="9" r="2" />
        <circle cx="9" cy="23" r="2" /><circle cx="23" cy="23" r="2" />
        <circle cx="16" cy="16" r="2.4" />
      </g>
    </svg>
  );
}

/** Full logo with wordmark. `size="large"` is for splash screens like the sign-in page. */
export function Logo({ tag = false, size = "default" }: { tag?: boolean; size?: "default" | "large" }) {
  const large = size === "large";
  return (
    <div className={`flex items-center ${large ? "gap-5" : "gap-2.5"}`}>
      <svg viewBox="0 0 32 32" className={large ? "h-24 w-24" : "h-8 w-8"} aria-hidden>
        <rect width="32" height="32" rx="7" className="fill-primary" />
        <g className="stroke-primary-foreground" strokeWidth="1.6" fill="none">
          <path d="M9 9h14v14H9zM16 9v14M9 16h14" />
        </g>
        <g className="fill-primary-foreground">
          <circle cx="9" cy="9" r="2" /><circle cx="23" cy="9" r="2" />
          <circle cx="9" cy="23" r="2" /><circle cx="23" cy="23" r="2" />
          <circle cx="16" cy="16" r="2.4" />
        </g>
      </svg>
      <div className="leading-tight">
        <div className={`font-serif font-semibold tracking-tight ${large ? "text-5xl" : "text-lg"}`}>Lattice Scout</div>
        {tag && (
          <div className={`font-mono tracking-[0.18em] text-muted-foreground ${large ? "text-sm" : "text-[10px]"}`}>
            BY LATTICE PRESS
          </div>
        )}
      </div>
    </div>
  );
}
