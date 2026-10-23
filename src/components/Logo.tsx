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
      </g>
      <circle cx="16" cy="16" r="2.4" fill="#EF4135" />
    </svg>
  );
}

/**
 * Full logo. The mark is sized in `em` against the wordmark's font size, so it
 * always matches the height of the "Faraday" letters. When `tag` is set, the
 * tagline sits centred under the whole lockup.
 */
export function Logo({ tag = false, size = "default" }: { tag?: boolean; size?: "default" | "large" }) {
  const large = size === "large";
  return (
    <div className="flex flex-col items-center">
      <div
        className={`flex items-center font-serif font-semibold leading-none tracking-tight ${
          large ? "gap-3 text-[38px]" : "gap-2 text-lg"
        }`}
      >
        <svg viewBox="0 0 32 32" className="h-[0.97em] w-[0.97em]" aria-hidden>
          <rect width="32" height="32" rx="7" className="fill-primary" />
          <g className="stroke-primary-foreground" strokeWidth="1.6" fill="none">
            <path d="M9 9h14v14H9zM16 9v14M9 16h14" />
          </g>
          <g className="fill-primary-foreground">
            <circle cx="9" cy="9" r="2" /><circle cx="23" cy="9" r="2" />
            <circle cx="9" cy="23" r="2" /><circle cx="23" cy="23" r="2" />
          </g>
          <circle cx="16" cy="16" r="2.4" fill="#EF4135" />
        </svg>
        <span>Faraday</span>
      </div>
      {tag && (
        <div className={`mt-2 font-mono tracking-[0.18em] text-muted-foreground ${large ? "text-xs" : "text-[10px]"}`}>
          GET OUT OF THE CAGE
        </div>
      )}
    </div>
  );
}
