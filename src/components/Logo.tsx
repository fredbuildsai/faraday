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

export function Logo({ tag = false }: { tag?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
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
        <div className="font-serif text-lg font-semibold tracking-tight">Lattice Scout</div>
        {tag && (
          <div className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
            BY LATTICE PRESS
          </div>
        )}
      </div>
    </div>
  );
}
